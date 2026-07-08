using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace DentalClinic
{
    public static class DatabaseHelper
    {
        private static readonly SqliteConnection _conn;
        private static readonly string _dataFolder;
        private static readonly string SqlServerConnectionString;
        private static readonly bool UseSqlServer;

        static DatabaseHelper()
        {
            SqlServerConnectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING");
            UseSqlServer = !string.IsNullOrEmpty(SqlServerConnectionString);

            if (UseSqlServer)
            {
                Console.WriteLine("[INFO] Iniciando base de datos en modo SQL Server persistente.");
                RunSqlServerMigrations();
                return;
            }

            Console.WriteLine("[INFO] Iniciando base de datos en modo local con archivos JSON.");

            // Locate the project root by finding schema.sql
            string schemaPath = FindSchemaSql();
            string rootDir = !string.IsNullOrEmpty(schemaPath) ? Path.GetDirectoryName(schemaPath) : AppDomain.CurrentDomain.BaseDirectory;

            // Define data folder in the project root folder (C:\SmileForEver\data)
            _dataFolder = Path.Combine(rootDir, "data");
            if (!Directory.Exists(_dataFolder))
            {
                Directory.CreateDirectory(_dataFolder);
            }

            // Create and maintain open connection to in-memory SQLite database
            _conn = new SqliteConnection("Data Source=SmileForEverInMem;Mode=Memory;Cache=Shared;");
            _conn.Open();

            // Register SQL Server equivalent functions in SQLite (GETDATE)
            _conn.CreateFunction("GETDATE", () => 
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

            InitializeDatabase();
        }

        private static void InitializeDatabase()
        {
            // 1. Create tables and default seed from schema.sql
            string schemaPath = FindSchemaSql();
            if (string.IsNullOrEmpty(schemaPath))
            {
                throw new FileNotFoundException("No se encontró el archivo schema.sql para inicializar la base de datos.");
            }

            string schemaSql = File.ReadAllText(schemaPath);
            // Split statements by GO separator
            string[] statements = schemaSql.Split(new[] { "\nGO", "\r\nGO", "GO\r\n", "GO\n" }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var stmt in statements)
            {
                if (stmt.Contains("INSERT "))
                {
                    // Split multiple inserts within a block by line
                    var lines = stmt.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        string sqliteStmt = TranslateToSqlite(line);
                        if (string.IsNullOrWhiteSpace(sqliteStmt)) continue;
                        ExecuteSingleStatement(sqliteStmt);
                    }
                }
                else
                {
                    string sqliteStmt = TranslateToSqlite(stmt);
                    if (string.IsNullOrWhiteSpace(sqliteStmt)) continue;
                    ExecuteSingleStatement(sqliteStmt);
                }
            }

            // 2. Load JSON data files if they exist (overrides initial seed data)
            var tables = GetTableNames();
            bool jsonExists = false;
            foreach (var table in tables)
            {
                string jsonPath = Path.Combine(_dataFolder, $"{table}.json");
                if (File.Exists(jsonPath))
                {
                    jsonExists = true;
                    LoadTableFromJson(table, jsonPath);
                }
            }

            // 3. Save current database to JSON files (seed data becomes JSON files if empty folder)
            if (!jsonExists)
            {
                SaveAllTablesToJson();
            }
        }

        private static void ExecuteSingleStatement(string sql)
        {
            try
            {
                using (var cmd = new SqliteCommand(sql, _conn))
                {
                    cmd.ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB_INIT_WARN] Error al ejecutar sentencia: {ex.Message}\nSentencia: {sql}");
            }
        }

        private static string FindSchemaSql()
        {
            string currentDir = AppDomain.CurrentDomain.BaseDirectory;
            while (!string.IsNullOrEmpty(currentDir))
            {
                string testPath = Path.Combine(currentDir, "schema.sql");
                if (File.Exists(testPath))
                {
                    return testPath;
                }
                currentDir = Path.GetDirectoryName(currentDir);
            }
            return null;
        }

        private static List<string> GetTableNames()
        {
            var list = new List<string>();
            using (var cmd = new SqliteCommand("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", _conn))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(reader.GetString(0));
                }
            }
            return list;
        }

        private static void LoadTableFromJson(string tableName, string jsonPath)
        {
            try
            {
                string json = File.ReadAllText(jsonPath);
                var rows = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(json);
                if (rows == null || rows.Count == 0) return;

                // Clear existing table contents
                using (var deleteCmd = new SqliteCommand($"DELETE FROM {tableName};", _conn))
                {
                    deleteCmd.ExecuteNonQuery();
                }

                foreach (var row in rows)
                {
                    var columns = new List<string>();
                    var paramNames = new List<string>();
                    var parameters = new Dictionary<string, object>();

                    int paramIndex = 0;
                    foreach (var kvp in row)
                    {
                        columns.Add(kvp.Key);
                        string paramName = $"@p{paramIndex++}";
                        paramNames.Add(paramName);
                        parameters[paramName] = kvp.Value ?? DBNull.Value;
                    }

                    string insertQuery = $"INSERT INTO {tableName} ({string.Join(", ", columns)}) VALUES ({string.Join(", ", paramNames)});";
                    using (var insertCmd = new SqliteCommand(insertQuery, _conn))
                    {
                        foreach (var param in parameters)
                        {
                            insertCmd.Parameters.AddWithValue(param.Key, param.Value);
                        }
                        insertCmd.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB_LOAD_ERROR] Error al cargar la tabla {tableName} desde JSON: {ex.Message}");
            }
        }

        private static void SaveAllTablesToJson()
        {
            var tables = GetTableNames();
            foreach (var table in tables)
            {
                string jsonPath = Path.Combine(_dataFolder, $"{table}.json");
                SaveTableToJson(table, jsonPath);
            }
        }

        private static void SaveTableToJson(string tableName, string jsonPath)
        {
            try
            {
                var list = new List<Dictionary<string, object>>();
                using (var cmd = new SqliteCommand($"SELECT * FROM {tableName}", _conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var row = new Dictionary<string, object>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            string name = reader.GetName(i);
                            object val = reader.GetValue(i);
                            row[name] = val == DBNull.Value ? null : val;
                        }
                        list.Add(row);
                    }
                }
                string json = JsonConvert.SerializeObject(list, Formatting.Indented);
                File.WriteAllText(jsonPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB_SAVE_ERROR] Error al guardar la tabla {tableName} a JSON: {ex.Message}");
            }
        }

        private static string TranslateQuery(string query)
        {
            // Remove SQL Server schema prefix
            string sql = query.Replace("[dbo].", "").Replace("dbo.", "").Replace("N'", "'");
            
            // Translate ISNULL to SQLite ifnull
            sql = Regex.Replace(sql, @"\bISNULL\s*\(", "ifnull(", RegexOptions.IgnoreCase);

            return sql;
        }

        private static string TranslateToSqlite(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) return "";

            // Remove SQL Server comments
            sql = Regex.Replace(sql, @"--.*$", "", RegexOptions.Multiline);

            if (sql.Contains("CREATE DATABASE") || sql.Contains("USE [") || sql.Contains("SET IDENTITY_INSERT"))
                return "";
            if (sql.Contains("IF NOT EXISTS (SELECT name FROM sys.databases"))
                return "";

            // Apply query level translations (ISNULL -> ifnull, etc.)
            sql = TranslateQuery(sql);

            // Insert INTO if missing
            sql = sql.Trim();
            if (sql.StartsWith("INSERT ", StringComparison.OrdinalIgnoreCase) && 
                !sql.StartsWith("INSERT INTO ", StringComparison.OrdinalIgnoreCase))
            {
                sql = "INSERT INTO " + sql.Substring(7);
            }

            // Remove filegroup directive
            sql = sql.Replace("ON [PRIMARY]", "");

            // Replace IDENTITY(1,1) definition with AUTOINCREMENT
            sql = Regex.Replace(
                sql, 
                @"\[?(\w+)\]?\s+\[?int\]?\s+IDENTITY\(\d+,\d+\)\s+NOT\s+NULL\s+PRIMARY\s+KEY", 
                "[$1] INTEGER PRIMARY KEY AUTOINCREMENT", 
                RegexOptions.IgnoreCase);

            sql = Regex.Replace(
                sql, 
                @"\[?(\w+)\]?\s+\[?int\]?\s+IDENTITY\(\d+,\d+\)\s+PRIMARY\s+KEY", 
                "[$1] INTEGER PRIMARY KEY AUTOINCREMENT", 
                RegexOptions.IgnoreCase);

            // Replace general data types and quotes
            sql = sql.Replace("[int]", "INTEGER").Replace("int ", "INTEGER ");
            sql = sql.Replace("[varchar]", "TEXT").Replace("varchar(", "TEXT(");
            sql = sql.Replace("[datetime]", "TEXT").Replace("datetime ", "TEXT ");
            sql = sql.Replace("[bit]", "INTEGER").Replace("bit ", "INTEGER ");
            sql = sql.Replace("[decimal]", "REAL").Replace("decimal(", "REAL(");
            sql = sql.Replace("[numeric]", "REAL").Replace("numeric(", "REAL(");
            sql = sql.Replace("[NTEXT]", "TEXT");

            // Replace (max) with empty string since SQLite doesn't support MAX size constraint on TEXT/VARCHAR
            sql = sql.Replace("(max)", "");

            // Replace CAST(val AS Type) with just val for SQLite compatibility in inserts
            sql = Regex.Replace(sql, @"CAST\s*\(\s*(.*?)\s+AS\s+(?:[a-zA-Z]+(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?)\s*\)", "$1", RegexOptions.IgnoreCase);

            // Drop table: Translate IF OBJECT_ID(...) DROP TABLE ...
            if (sql.Contains("DROP TABLE"))
            {
                var dropMatch = Regex.Match(sql, @"DROP\s+TABLE\s+(\w+)", RegexOptions.IgnoreCase);
                if (dropMatch.Success)
                {
                    string tableName = dropMatch.Groups[1].Value;
                    return $"DROP TABLE IF EXISTS {tableName};";
                }
            }

            // Ignore Stored Procedure definitions
            if (sql.Contains("CREATE PROCEDURE") || sql.Contains("sp_ConsultaOdontograma"))
                return "";

            return sql.Trim();
        }

        private static void BindParameters(SqliteCommand cmd, Dictionary<string, object> parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    string key = param.Key.StartsWith("@") ? param.Key : "@" + param.Key;
                    cmd.Parameters.AddWithValue(key, param.Value ?? DBNull.Value);
                }
            }
        }

        private static void BindSqlServerParameters(SqlCommand cmd, Dictionary<string, object> parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    string key = param.Key.StartsWith("@") ? param.Key : "@" + param.Key;
                    cmd.Parameters.AddWithValue(key, param.Value ?? DBNull.Value);
                }
            }
        }

        public static DataTable ExecuteQuery(string query, Dictionary<string, object> parameters = null)
        {
            if (UseSqlServer)
            {
                using (var conn = new SqlConnection(SqlServerConnectionString))
                using (var cmd = new SqlCommand(query, conn))
                {
                    conn.Open();
                    BindSqlServerParameters(cmd, parameters);
                    using (var adapter = new SqlDataAdapter(cmd))
                    {
                        var dt = new DataTable();
                        adapter.Fill(dt);
                        return dt;
                    }
                }
            }
            else
            {
                string sql = TranslateQuery(query);
                using (var cmd = new SqliteCommand(sql, _conn))
                {
                    BindParameters(cmd, parameters);
                    using (var reader = cmd.ExecuteReader())
                    {
                        var dt = new DataTable();
                        
                        // Create columns dynamically with AllowDBNull = true to avoid ADO.NET constraints check errors
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            dt.Columns.Add(reader.GetName(i), reader.GetFieldType(i));
                        }
                        
                        // Load rows manually to prevent constraint violation exceptions
                        while (reader.Read())
                        {
                            var row = dt.NewRow();
                            for (int i = 0; i < reader.FieldCount; i++)
                            {
                                object val = reader.GetValue(i);
                                row[i] = val ?? DBNull.Value;
                            }
                            dt.Rows.Add(row);
                        }
                        
                        return dt;
                    }
                }
            }
        }

        public static int ExecuteNonQuery(string query, Dictionary<string, object> parameters = null)
        {
            if (UseSqlServer)
            {
                using (var conn = new SqlConnection(SqlServerConnectionString))
                using (var cmd = new SqlCommand(query, conn))
                {
                    conn.Open();
                    BindSqlServerParameters(cmd, parameters);
                    return cmd.ExecuteNonQuery();
                }
            }
            else
            {
                string sql = TranslateQuery(query);
                using (var cmd = new SqliteCommand(sql, _conn))
                {
                    BindParameters(cmd, parameters);
                    int rows = cmd.ExecuteNonQuery();
                    SaveAllTablesToJson();
                    return rows;
                }
            }
        }

        public static object ExecuteScalar(string query, Dictionary<string, object> parameters = null)
        {
            if (UseSqlServer)
            {
                using (var conn = new SqlConnection(SqlServerConnectionString))
                using (var cmd = new SqlCommand(query, conn))
                {
                    conn.Open();
                    BindSqlServerParameters(cmd, parameters);
                    return cmd.ExecuteScalar();
                }
            }
            else
            {
                string sql = TranslateQuery(query);
                using (var cmd = new SqliteCommand(sql, _conn))
                {
                    BindParameters(cmd, parameters);
                    object result = cmd.ExecuteScalar();
                    SaveAllTablesToJson();
                    return result;
                }
            }
        }

        private static void RunSqlServerMigrations()
        {
            try
            {
                using (var conn = new SqlConnection(SqlServerConnectionString))
                {
                    conn.Open();
                    
                    // 1. Add Monto column to tbl_TratamientoPaciente if missing
                    string checkQuery = @"
                        IF NOT EXISTS (
                            SELECT * FROM sys.columns 
                            WHERE object_id = OBJECT_ID('dbo.tbl_TratamientoPaciente') 
                            AND name = 'Monto'
                        )
                        BEGIN
                            ALTER TABLE dbo.tbl_TratamientoPaciente ADD Monto decimal(12, 2) NULL;
                        END";
                    using (var cmd = new SqlCommand(checkQuery, conn))
                    {
                        cmd.ExecuteNonQuery();
                    }

                    // 2. Add Diagnostico column to tbl_MapavsOdontograma if missing
                    string checkQuery2 = @"
                        IF NOT EXISTS (
                            SELECT * FROM sys.columns 
                            WHERE object_id = OBJECT_ID('dbo.tbl_MapavsOdontograma') 
                            AND name = 'Diagnostico'
                        )
                        BEGIN
                            ALTER TABLE dbo.tbl_MapavsOdontograma ADD Diagnostico varchar(1000) NULL;
                        END";
                    using (var cmd2 = new SqlCommand(checkQuery2, conn))
                    {
                        cmd2.ExecuteNonQuery();
                    }
                }
                Console.WriteLine("[INFO] Migración de base de datos SQL Server completada con éxito.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error al ejecutar migraciones en SQL Server: {ex.Message}");
            }
        }

        public static List<Dictionary<string, object>> ToList(this DataTable dt)
        {
            var list = new List<Dictionary<string, object>>();
            foreach (DataRow row in dt.Rows)
            {
                var dict = new Dictionary<string, object>();
                foreach (DataColumn col in dt.Columns)
                {
                    dict[col.ColumnName] = row[col] == DBNull.Value ? null : row[col];
                }
                list.Add(dict);
            }
            return list;
        }
    }
}
