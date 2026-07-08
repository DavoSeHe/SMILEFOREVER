using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Net;
using System.Text;
using Newtonsoft.Json;

namespace DentalClinic
{
    class Program
    {
        private static string wwwrootPath;
        private static HttpListener listener;
        private static bool isRunning = true;

        static void Main(string[] args)
        {
            // Initialize database on startup
            try
            {
                DatabaseHelper.ExecuteScalar("SELECT 1;");
                Console.WriteLine("[INFO] Base de datos JSON inicializada correctamente.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Falló la inicialización de la base de datos: {ex.Message}");
                return;
            }

            // Set paths relative to execution directory with robust upward search
            string currentDir = AppDomain.CurrentDomain.BaseDirectory;
            wwwrootPath = null;
            while (!string.IsNullOrEmpty(currentDir))
            {
                string testPath = Path.Combine(currentDir, "wwwroot");
                if (Directory.Exists(testPath) && File.Exists(Path.Combine(testPath, "index.html")))
                {
                    wwwrootPath = testPath;
                    break;
                }
                currentDir = Path.GetDirectoryName(currentDir);
            }

            if (string.IsNullOrEmpty(wwwrootPath))
            {
                // Fallback if not found during search (create in base directory)
                wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                if (!Directory.Exists(wwwrootPath))
                {
                    Directory.CreateDirectory(wwwrootPath);
                }
            }

            string portEnv = Environment.GetEnvironmentVariable("PORT");
            int port = !string.IsNullOrEmpty(portEnv) && int.TryParse(portEnv, out int p) ? p : 5000;

            string host = Environment.GetEnvironmentVariable("HOST");
            if (string.IsNullOrEmpty(host))
            {
                host = (Environment.OSVersion.Platform == PlatformID.Unix) ? "*" : "localhost";
            }

            listener = new HttpListener();
            listener.Prefixes.Add($"http://{host}:{port}/");

            try
            {
                listener.Start();
                Console.WriteLine($"[INFO] Servidor dental corriendo en http://{host}:{port}/");
                Console.WriteLine($"[INFO] Raíz de archivos estáticos: {wwwrootPath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] No se pudo iniciar el servidor en {host}:{port}: {ex.Message}");
                return;
            }

            // Start listening loop
            while (isRunning)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    System.Threading.ThreadPool.QueueUserWorkItem((state) =>
                    {
                        HandleRequest((HttpListenerContext)state);
                    }, context);
                }
                catch (Exception ex)
                {
                    if (!isRunning) break;
                    Console.WriteLine($"[ERROR] Error en el bucle de escucha: {ex.Message}");
                }
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            string urlPath = request.Url.LocalPath;
            string method = request.HttpMethod;

            // Set default headers
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Accept");

            if (method == "OPTIONS")
            {
                response.StatusCode = (int)HttpStatusCode.OK;
                response.Close();
                return;
            }

            Console.WriteLine($"[REQ] {method} {urlPath}");

            try
            {
                // API Routes
                if (urlPath.StartsWith("/api/"))
                {
                    HandleApiRequest(context, urlPath, method);
                }
                // Static Files Routes
                else
                {
                    HandleStaticFileRequest(context, urlPath);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error procesando requerimiento: {ex.Message}\n{ex.StackTrace}");
                SendJsonError(response, HttpStatusCode.InternalServerError, ex.Message);
            }
        }

        private static void HandleStaticFileRequest(HttpListenerContext context, string urlPath)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            // Normalize path
            if (urlPath == "/")
            {
                urlPath = "/index.html";
            }

            string filePath = Path.Combine(wwwrootPath, urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            if (File.Exists(filePath))
            {
                byte[] fileBytes = File.ReadAllBytes(filePath);
                response.ContentType = GetContentType(filePath);
                response.ContentLength64 = fileBytes.Length;
                response.StatusCode = (int)HttpStatusCode.OK;
                response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                response.Close();
            }
            else
            {
                // Serve index.html as fallback for SPA routing
                string indexFallback = Path.Combine(wwwrootPath, "index.html");
                if (File.Exists(indexFallback))
                {
                    byte[] fileBytes = File.ReadAllBytes(indexFallback);
                    response.ContentType = "text/html";
                    response.ContentLength64 = fileBytes.Length;
                    response.StatusCode = (int)HttpStatusCode.OK;
                    response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                    response.Close();
                }
                else
                {
                    SendJsonError(response, HttpStatusCode.NotFound, "Archivo no encontrado.");
                }
            }
        }

        private static void HandleApiRequest(HttpListenerContext context, string path, string method)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            // 1. LOGIN & LOGOUT
            if (path == "/api/login" && method == "POST")
            {
                var body = GetRequestBody(request);
                string email = body["email"]?.ToString();
                string password = body["password"]?.ToString();

                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "Usuario y contraseña son requeridos.");
                    return;
                }

                // Password encoding: UTF-16LE Base64
                string encodedPass = Convert.ToBase64String(Encoding.Unicode.GetBytes(password));

                string query = @"
                    SELECT u.id_Usuario, u.Email, u.Telefono, u.Activo, d.Nombre, d.ApPat, d.ApMat, d.id_Roll, r.Roll, d.Foto, d.id_Tipificacion, t.Color as TipificacionColor
                    FROM tbl_Usuario u
                    JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                    JOIN tbl_Roles r ON d.id_Roll = r.id_Roll
                    LEFT JOIN tbl_Tipificaciones t ON d.id_Tipificacion = t.id_Tipificacion
                    WHERE u.Email = @Email AND u.Pass = @Pass AND u.Activo = 1";

                var parameters = new Dictionary<string, object>
                {
                    { "@Email", email },
                    { "@Pass", encodedPass }
                };

                DataTable dt = DatabaseHelper.ExecuteQuery(query, parameters);

                if (dt.Rows.Count > 0)
                {
                    var user = dt.ToList()[0];
                    // Set cookie containing only id_Usuario to prevent HTTP header size limits overflow (65KB max)
                    var cookieUser = new Dictionary<string, object>
                    {
                        { "id_Usuario", user["id_Usuario"] }
                    };
                    string cookieData = JsonConvert.SerializeObject(cookieUser);
                    string cookieBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(cookieData));
                    
                    var cookie = new Cookie("SessionUser", cookieBase64)
                    {
                        Path = "/",
                        Expires = DateTime.Now.AddDays(1)
                    };
                    response.AppendCookie(cookie);

                    SendJsonResponse(response, HttpStatusCode.OK, user);
                }
                else
                {
                    SendJsonError(response, HttpStatusCode.Unauthorized, "Credenciales incorrectas o usuario inactivo.");
                }
                return;
            }

            if (path == "/api/logout" && method == "POST")
            {
                var cookie = new Cookie("SessionUser", "")
                {
                    Path = "/",
                    Expires = DateTime.Now.AddDays(-1)
                };
                response.AppendCookie(cookie);
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Logout exitoso" });
                return;
            }

            if (path == "/api/session" && method == "GET")
            {
                var cookie = request.Cookies["SessionUser"];
                if (cookie != null && !string.IsNullOrEmpty(cookie.Value))
                {
                    try
                    {
                        byte[] data = Convert.FromBase64String(cookie.Value);
                        string json = Encoding.UTF8.GetString(data);
                        var cookieUser = JsonConvert.DeserializeObject<Dictionary<string, object>>(json);
                        if (cookieUser != null && cookieUser.ContainsKey("id_Usuario"))
                        {
                            int userId = Convert.ToInt32(cookieUser["id_Usuario"]);
                            string sessionQuery = @"
                                SELECT u.id_Usuario, u.Email, u.Telefono, u.Activo, d.Nombre, d.ApPat, d.ApMat, d.id_Roll, r.Roll, d.Foto, d.id_Tipificacion, t.Color as TipificacionColor
                                FROM tbl_Usuario u
                                JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                                JOIN tbl_Roles r ON d.id_Roll = r.id_Roll
                                LEFT JOIN tbl_Tipificaciones t ON d.id_Tipificacion = t.id_Tipificacion
                                WHERE u.id_Usuario = @Id AND u.Activo = 1";
                            DataTable dt = DatabaseHelper.ExecuteQuery(sessionQuery, new Dictionary<string, object> { { "@Id", userId } });
                            if (dt.Rows.Count > 0)
                            {
                                var user = dt.ToList()[0];
                                SendJsonResponse(response, HttpStatusCode.OK, user);
                                return;
                            }
                        }
                    }
                    catch
                    {
                        // Invalid cookie, clear it
                    }
                }
                SendJsonError(response, HttpStatusCode.Unauthorized, "No hay sesión activa.");
                return;
            }

            // 2. PACIENTES / BUSQUEDA
            if (path == "/api/pacientes" && method == "GET")
            {
                string search = request.QueryString["search"];
                string query = @"
                    SELECT u.id_Usuario, u.Email, u.Telefono, d.Nombre, d.ApPat, d.ApMat, d.Sexo, d.Ocupacion, d.FechaNat, d.Domicilio, d.TelefonoEmergencia, d.MotivoConsulta, d.id_Roll, d.Observaciones, d.Foto, d.id_Tipificacion, t.Color as TipificacionColor, t.Nivel as TipificacionNivel
                    FROM tbl_Usuario u
                    JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                    LEFT JOIN tbl_Tipificaciones t ON d.id_Tipificacion = t.id_Tipificacion
                    WHERE d.id_Roll = 5 AND u.Activo = 1";

                var parameters = new Dictionary<string, object>();
                if (!string.IsNullOrEmpty(search))
                {
                    query += " AND (d.Nombre LIKE @Search OR d.ApPat LIKE @Search OR d.ApMat LIKE @Search OR u.Email LIKE @Search)";
                    parameters.Add("@Search", $"%{search}%");
                }

                DataTable dt = DatabaseHelper.ExecuteQuery(query, parameters);
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            // 3. REGISTRO DE USUARIOS (CRUD)
            if (path == "/api/usuarios" && method == "GET")
            {
                string idStr = request.QueryString["id"];
                if (!string.IsNullOrEmpty(idStr))
                {
                    int id = int.Parse(idStr);
                    string query = @"
                        SELECT u.id_Usuario, u.Email, u.Telefono, d.Nombre, d.ApPat, d.ApMat, d.Sexo, d.Ocupacion, d.FechaNat, d.Domicilio, d.TelefonoEmergencia, d.MotivoConsulta, d.id_Roll, r.Roll, d.Observaciones, d.Foto, d.id_Tipificacion, t.Color as TipificacionColor
                        FROM tbl_Usuario u
                        JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                        JOIN tbl_Roles r ON d.id_Roll = r.id_Roll
                        LEFT JOIN tbl_Tipificaciones t ON d.id_Tipificacion = t.id_Tipificacion
                        WHERE u.id_Usuario = @Id AND u.Activo = 1";

                    DataTable dt = DatabaseHelper.ExecuteQuery(query, new Dictionary<string, object> { { "@Id", id } });
                    if (dt.Rows.Count > 0)
                    {
                        SendJsonResponse(response, HttpStatusCode.OK, dt.ToList()[0]);
                    }
                    else
                    {
                        SendJsonError(response, HttpStatusCode.NotFound, "Usuario no encontrado.");
                    }
                }
                else
                {
                    string query = @"
                        SELECT u.id_Usuario, u.Email, u.Telefono, d.Nombre, d.ApPat, d.ApMat, d.id_Roll, r.Roll, u.Activo
                        FROM tbl_Usuario u
                        JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                        JOIN tbl_Roles r ON d.id_Roll = r.id_Roll
                        WHERE u.Activo = 1";
                    DataTable dt = DatabaseHelper.ExecuteQuery(query);
                    SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                }
                return;
            }

            if (path == "/api/usuarios" && method == "POST")
            {
                var body = GetRequestBody(request);
                int roleId = Convert.ToInt32(body["id_Roll"]);
                string email = body["email"]?.ToString();
                string pass = body["pass"]?.ToString();
                string name = body["nombre"]?.ToString();
                string apPat = body["apPat"]?.ToString();
                string apMat = body["apMat"]?.ToString();
                string sex = body["sexo"]?.ToString() ?? "Otro";
                string phoneStr = body["telefono"]?.ToString();
                string occupation = body["ocupacion"]?.ToString();
                string birthStr = body["fechaNat"]?.ToString();
                string address = body["domicilio"]?.ToString();
                string emergPhone = body["telefonoEmergencia"]?.ToString();
                string motive = body["motivoConsulta"]?.ToString();
                string remarks = body["observaciones"]?.ToString();
                string foto = body["foto"]?.ToString();
                int? tipificacionId = body.ContainsKey("id_Tipificacion") && body["id_Tipificacion"] != null ? (int?)Convert.ToInt32(body["id_Tipificacion"]) : null;

                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pass) || string.IsNullOrEmpty(name))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "Email, Contraseña y Nombre son campos requeridos.");
                    return;
                }

                // Check if user email already exists
                var checkDt = DatabaseHelper.ExecuteQuery("SELECT 1 FROM tbl_Usuario WHERE Email = @Email AND Activo = 1", new Dictionary<string, object> { { "@Email", email } });
                if (checkDt.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.Conflict, "El correo electrónico ya está registrado.");
                    return;
                }

                // Get new id_Usuario
                object maxIdObj = DatabaseHelper.ExecuteScalar("SELECT ISNULL(MAX(id_Usuario), 0) + 1 FROM tbl_Usuario");
                int newUserId = Convert.ToInt32(maxIdObj);

                // Insert into tbl_Usuario
                string encodedPass = Convert.ToBase64String(Encoding.Unicode.GetBytes(pass));
                int phone = 0;
                int.TryParse(phoneStr, out phone);

                string insertUser = @"
                    INSERT INTO tbl_Usuario (id_Usuario, Email, Telefono, Pass, FechaCreado, FechaModificado, Activo, Temporal)
                    VALUES (@Id, @Email, @Phone, @Pass, GETDATE(), GETDATE(), 1, 0)";

                var userParams = new Dictionary<string, object>
                {
                    { "@Id", newUserId },
                    { "@Email", email },
                    { "@Phone", phone },
                    { "@Pass", encodedPass }
                };
                DatabaseHelper.ExecuteNonQuery(insertUser, userParams);

                // Insert into tbl_UsuarioDatos
                DateTime? birthDate = null;
                if (!string.IsNullOrEmpty(birthStr)) birthDate = DateTime.Parse(birthStr);

                string insertUserData = @"
                    INSERT INTO tbl_UsuarioDatos (id_Usuario, Nombre, ApPat, ApMat, Sexo, Ocupacion, FechaNat, Domicilio, Email, Telefono, TelefonoEmergencia, MotivoConsulta, id_Roll, Observaciones, Foto, id_Tipificacion)
                    VALUES (@Id, @Nombre, @ApPat, @ApMat, @Sexo, @Ocupacion, @FechaNat, @Domicilio, @Email, @TelefonoVal, @TelefonoEmergencia, @MotivoConsulta, @id_Roll, @Observaciones, @Foto, @id_Tipificacion)";

                decimal? phoneVal = null;
                if (!string.IsNullOrEmpty(phoneStr)) phoneVal = decimal.Parse(phoneStr);

                var userDataParams = new Dictionary<string, object>
                {
                    { "@Id", newUserId },
                    { "@Nombre", name },
                    { "@ApPat", apPat ?? "" },
                    { "@ApMat", apMat ?? "" },
                    { "@Sexo", sex },
                    { "@Ocupacion", occupation },
                    { "@FechaNat", birthDate },
                    { "@Domicilio", address },
                    { "@Email", email },
                    { "@TelefonoVal", phoneVal },
                    { "@TelefonoEmergencia", emergPhone },
                    { "@MotivoConsulta", roleId == 5 ? motive : null }, // Motivo visible only for patient
                    { "@id_Roll", roleId },
                    { "@Observaciones", remarks },
                    { "@Foto", foto },
                    { "@id_Tipificacion", roleId == 5 ? tipificacionId : null }
                };
                DatabaseHelper.ExecuteNonQuery(insertUserData, userDataParams);

                SendJsonResponse(response, HttpStatusCode.Created, new { id_Usuario = newUserId, message = "Usuario registrado con éxito." });
                return;
            }

            if (path == "/api/usuarios" && method == "PUT")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_Usuario"]);
                int roleId = Convert.ToInt32(body["id_Roll"]);
                string name = body.ContainsKey("nombre") ? body["nombre"]?.ToString() : null;
                string apPat = body.ContainsKey("apPat") ? body["apPat"]?.ToString() : null;
                string apMat = body.ContainsKey("apMat") ? body["apMat"]?.ToString() : null;
                
                string sex = body.ContainsKey("sexo") ? body["sexo"]?.ToString() : null;
                string phoneStr = body.ContainsKey("telefono") ? body["telefono"]?.ToString() : null;
                string occupation = body.ContainsKey("ocupacion") ? body["ocupacion"]?.ToString() : null;
                string birthStr = body.ContainsKey("fechaNat") ? body["fechaNat"]?.ToString() : null;
                string address = body.ContainsKey("domicilio") ? body["domicilio"]?.ToString() : null;
                string emergPhone = body.ContainsKey("telefonoEmergencia") ? body["telefonoEmergencia"]?.ToString() : null;
                string motive = body.ContainsKey("motivoConsulta") ? body["motivoConsulta"]?.ToString() : null;
                string remarks = body.ContainsKey("observaciones") ? body["observaciones"]?.ToString() : null;
                string foto = body.ContainsKey("foto") ? body["foto"]?.ToString() : null;
                int? tipificacionId = body.ContainsKey("id_Tipificacion") && body["id_Tipificacion"] != null ? (int?)Convert.ToInt32(body["id_Tipificacion"]) : null;

                if (userId <= 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "ID de usuario es requerido.");
                    return;
                }

                // If fields are missing in partial update, fetch existing user data to merge
                DataTable currentDt = DatabaseHelper.ExecuteQuery(
                    "SELECT u.Email, u.Telefono, d.Nombre, d.ApPat, d.ApMat, d.Sexo, d.Ocupacion, d.FechaNat, d.Domicilio, d.TelefonoEmergencia, d.MotivoConsulta, d.id_Roll, d.Observaciones, d.Foto, d.id_Tipificacion FROM tbl_Usuario u JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario WHERE u.id_Usuario = @Id",
                    new Dictionary<string, object> { { "@Id", userId } }
                );

                if (currentDt.Rows.Count == 0)
                {
                    SendJsonError(response, HttpStatusCode.NotFound, "Usuario no encontrado.");
                    return;
                }

                DataRow row = currentDt.Rows[0];
                if (name == null) name = row["Nombre"].ToString();
                if (apPat == null) apPat = row["ApPat"].ToString();
                if (apMat == null) apMat = row["ApMat"].ToString();
                if (sex == null) sex = row["Sexo"].ToString();
                if (phoneStr == null) phoneStr = row["Telefono"] != DBNull.Value ? row["Telefono"].ToString() : null;
                if (occupation == null) occupation = row["Ocupacion"] != DBNull.Value ? row["Ocupacion"].ToString() : null;
                if (birthStr == null && row["FechaNat"] != DBNull.Value) birthStr = Convert.ToDateTime(row["FechaNat"]).ToString("yyyy-MM-dd");
                if (address == null) address = row["Domicilio"] != DBNull.Value ? row["Domicilio"].ToString() : null;
                if (emergPhone == null) emergPhone = row["TelefonoEmergencia"] != DBNull.Value ? row["TelefonoEmergencia"].ToString() : null;
                if (motive == null) motive = row["MotivoConsulta"] != DBNull.Value ? row["MotivoConsulta"].ToString() : null;
                if (remarks == null) remarks = row["Observaciones"] != DBNull.Value ? row["Observaciones"].ToString() : null;
                if (foto == null) foto = row["Foto"] != DBNull.Value ? row["Foto"].ToString() : null;
                if (!body.ContainsKey("id_Tipificacion"))
                {
                    tipificacionId = row["id_Tipificacion"] != DBNull.Value ? (int?)Convert.ToInt32(row["id_Tipificacion"]) : null;
                }

                // Update tbl_Usuario (phone & modified date)
                int phone = 0;
                if (!string.IsNullOrEmpty(phoneStr)) int.TryParse(phoneStr, out phone);
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Usuario SET Telefono = @Phone, FechaModificado = GETDATE() WHERE id_Usuario = @Id",
                    new Dictionary<string, object> { { "@Phone", phone }, { "@Id", userId } }
                );

                // Update tbl_UsuarioDatos
                DateTime? birthDate = null;
                if (!string.IsNullOrEmpty(birthStr)) birthDate = DateTime.Parse(birthStr);

                decimal? phoneVal = null;
                if (!string.IsNullOrEmpty(phoneStr)) phoneVal = decimal.Parse(phoneStr);

                string updateUserData = @"
                    UPDATE tbl_UsuarioDatos
                    SET Nombre = @Nombre, ApPat = @ApPat, ApMat = @ApMat, Sexo = @Sexo, Ocupacion = @Ocupacion, 
                        FechaNat = @FechaNat, Domicilio = @Domicilio, Telefono = @TelefonoVal, 
                        TelefonoEmergencia = @TelefonoEmergencia, MotivoConsulta = @MotivoConsulta, 
                        id_Roll = @id_Roll, Observaciones = @Observaciones, 
                        Foto = @Foto,
                        id_Tipificacion = @id_Tipificacion
                    WHERE id_Usuario = @Id";

                var userDataParams = new Dictionary<string, object>
                {
                    { "@Id", userId },
                    { "@Nombre", name },
                    { "@ApPat", apPat ?? "" },
                    { "@ApMat", apMat ?? "" },
                    { "@Sexo", sex },
                    { "@Ocupacion", occupation },
                    { "@FechaNat", birthDate },
                    { "@Domicilio", address },
                    { "@TelefonoVal", phoneVal },
                    { "@TelefonoEmergencia", emergPhone },
                    { "@MotivoConsulta", roleId == 5 ? motive : null },
                    { "@id_Roll", roleId },
                    { "@Observaciones", remarks },
                    { "@Foto", string.IsNullOrEmpty(foto) ? null : foto },
                    { "@id_Tipificacion", roleId == 5 ? tipificacionId : null }
                };
                DatabaseHelper.ExecuteNonQuery(updateUserData, userDataParams);

                // Handle password change if provided in edit
                if (body.ContainsKey("pass") && !string.IsNullOrEmpty(body["pass"]?.ToString()))
                {
                    string pass = body["pass"].ToString();
                    string encodedPass = Convert.ToBase64String(Encoding.Unicode.GetBytes(pass));
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE tbl_Usuario SET Pass = @Pass WHERE id_Usuario = @Id",
                        new Dictionary<string, object> { { "@Pass", encodedPass }, { "@Id", userId } }
                    );
                }

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Usuario actualizado con éxito." });
                return;
            }

            if (path == "/api/usuarios" && method == "DELETE")
            {
                string idStr = request.QueryString["id"];
                if (string.IsNullOrEmpty(idStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "ID es requerido.");
                    return;
                }

                int id = int.Parse(idStr);
                // Soft delete by setting Activo = 0
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Usuario SET Activo = 0 WHERE id_Usuario = @Id",
                    new Dictionary<string, object> { { "@Id", id } }
                );

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Usuario eliminado con éxito (Baja)." });
                return;
            }

            // 4. PATOLOGIAS
            if (path == "/api/patologias" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                if (!string.IsNullOrEmpty(userIdStr))
                {
                    int userId = int.Parse(userIdStr);
                    
                    // Get Personal Pathologies
                    string queryPersonal = @"
                        SELECT id_AntecedentePersonal, Id_Patologia
                        FROM tbl_AntecedentesPersonales
                        WHERE Id_user = @UserId";
                    DataTable dtPersonal = DatabaseHelper.ExecuteQuery(queryPersonal, new Dictionary<string, object> { { "@UserId", userId } });

                    // Get Family Pathologies
                    string queryFamily = @"
                        SELECT id_AntecedenteFam, Madre, AbuelaMat, AbueloMat, OtrosMat, Padre, AbuelaPat, AbueloPat, OtrosPat, Hermanos
                        FROM tbl_AntecedentesFamiliares
                        WHERE Id_user = @UserId";
                    DataTable dtFamily = DatabaseHelper.ExecuteQuery(queryFamily, new Dictionary<string, object> { { "@UserId", userId } });

                    var result = new Dictionary<string, object>
                    {
                        { "personales", dtPersonal.ToList() },
                        { "familiares", dtFamily.Rows.Count > 0 ? dtFamily.ToList()[0] : null }
                    };

                    SendJsonResponse(response, HttpStatusCode.OK, result);
                }
                else
                {
                    // Return all pathologies catalog
                    DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_Patologia, Patologia, AntFamiliar FROM tbl_Patologias");
                    SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                }
                return;
            }

            if (path == "/api/patologias" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);

                // 1. Save Personal Pathologies (list of pathology names or IDs)
                string personalStr = body["personales"]?.ToString();
                List<string> personalList = JsonConvert.DeserializeObject<List<string>>(personalStr ?? "[]");

                // Clear old personal
                DatabaseHelper.ExecuteNonQuery("DELETE FROM tbl_AntecedentesPersonales WHERE Id_user = @UserId", new Dictionary<string, object> { { "@UserId", userId } });

                // Insert new ones
                foreach (string pat in personalList)
                {
                    DatabaseHelper.ExecuteNonQuery(
                        "INSERT INTO tbl_AntecedentesPersonales (Id_Patologia, Id_user) VALUES (@PatId, @UserId)",
                        new Dictionary<string, object> { { "@PatId", pat }, { "@UserId", userId } }
                    );
                }

                // 2. Save Family Pathologies
                var fam = body["familiares"] != null ? JsonConvert.DeserializeObject<Dictionary<string, List<string>>>(body["familiares"].ToString()) : new Dictionary<string, List<string>>();
                
                string madre = fam.ContainsKey("Madre") && fam["Madre"] != null ? string.Join(", ", fam["Madre"]) : null;
                string abuelaMat = fam.ContainsKey("AbuelaMat") && fam["AbuelaMat"] != null ? string.Join(", ", fam["AbuelaMat"]) : null;
                string abueloMat = fam.ContainsKey("AbueloMat") && fam["AbueloMat"] != null ? string.Join(", ", fam["AbueloMat"]) : null;
                string otrosMat = fam.ContainsKey("OtrosMat") && fam["OtrosMat"] != null ? string.Join(", ", fam["OtrosMat"]) : null;
                string padre = fam.ContainsKey("Padre") && fam["Padre"] != null ? string.Join(", ", fam["Padre"]) : null;
                string abuelaPat = fam.ContainsKey("AbuelaPat") && fam["AbuelaPat"] != null ? string.Join(", ", fam["AbuelaPat"]) : null;
                string abueloPat = fam.ContainsKey("AbueloPat") && fam["AbueloPat"] != null ? string.Join(", ", fam["AbueloPat"]) : null;
                string otrosPat = fam.ContainsKey("OtrosPat") && fam["OtrosPat"] != null ? string.Join(", ", fam["OtrosPat"]) : null;
                string hermanos = fam.ContainsKey("Hermanos") && fam["Hermanos"] != null ? string.Join(", ", fam["Hermanos"]) : null;

                // Check if exists
                DataTable famCheck = DatabaseHelper.ExecuteQuery("SELECT 1 FROM tbl_AntecedentesFamiliares WHERE Id_user = @UserId", new Dictionary<string, object> { { "@UserId", userId } });
                string famQuery;
                var famParams = new Dictionary<string, object>
                {
                    { "@UserId", userId },
                    { "@Madre", madre },
                    { "@AbuelaMat", abuelaMat },
                    { "@AbueloMat", abueloMat },
                    { "@OtrosMat", otrosMat },
                    { "@Padre", padre },
                    { "@AbuelaPat", abuelaPat },
                    { "@AbueloPat", abueloPat },
                    { "@OtrosPat", otrosPat },
                    { "@Hermanos", hermanos }
                };

                if (famCheck.Rows.Count > 0)
                {
                    famQuery = @"
                        UPDATE tbl_AntecedentesFamiliares
                        SET Madre=@Madre, AbuelaMat=@AbuelaMat, AbueloMat=@AbueloMat, OtrosMat=@OtrosMat, 
                            Padre=@Padre, AbuelaPat=@AbuelaPat, AbueloPat=@AbueloPat, OtrosPat=@OtrosPat, Hermanos=@Hermanos
                        WHERE Id_user = @UserId";
                }
                else
                {
                    famQuery = @"
                        INSERT INTO tbl_AntecedentesFamiliares (Madre, AbuelaMat, AbueloMat, OtrosMat, Padre, AbuelaPat, AbueloPat, OtrosPat, Hermanos, Id_user)
                        VALUES (@Madre, @AbuelaMat, @AbueloMat, @OtrosMat, @Padre, @AbuelaPat, @AbueloPat, @OtrosPat, @Hermanos, @UserId)";
                }
                DatabaseHelper.ExecuteNonQuery(famQuery, famParams);

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Patologías guardadas correctamente." });
                return;
            }

            // 5. ODONTOGRAMA
            if (path == "/api/odontograma" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                string formatStr = request.QueryString["formato"]; // 1 for adult, 0 for child
                
                int userId = int.TryParse(userIdStr, out var uId) ? uId : 0;
                int format = int.TryParse(formatStr, out var f) ? f : 1;

                // Query teeth layout. If user has treatment on it, return the treatment details, otherwise default
                string query = @"
                    SELECT 
                        o.id_Diente,
                        o.nivel,
                        ISNULL(mvo.id_MapaOdontograma, o.id_MapaOdontograma) as id_MapaOdontograma,
                        mo.Descripcion,
                        mo.Url,
                        mo.Acronimo,
                        mvo.Diagnostico
                    FROM tbl_Odontograma o
                    LEFT JOIN tbl_MapavsOdontograma mvo ON o.id_Diente = mvo.id_Diente AND mvo.id_Usuario = @UserId
                    JOIN tbl_MapaOdontograma mo ON ISNULL(mvo.id_MapaOdontograma, o.id_MapaOdontograma) = mo.id_MapaOdontograma
                    WHERE o.Formato = @Format
                    ORDER BY o.nivel, o.id_Diente";

                var parameters = new Dictionary<string, object>
                {
                    { "@UserId", userId },
                    { "@Format", format }
                };

                DataTable dt = DatabaseHelper.ExecuteQuery(query, parameters);
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/odontograma" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);
                int toothId = Convert.ToInt32(body["id_diente"]);
                int mapId = Convert.ToInt32(body["id_mapa"]); // The treatment ID from tbl_MapaOdontograma
                string diagnostico = body.ContainsKey("diagnostico") ? body["diagnostico"]?.ToString() : null;

                // Check if treatment exists for this user and tooth
                string checkQuery = "SELECT 1 FROM tbl_MapavsOdontograma WHERE id_Usuario = @UserId AND id_Diente = @ToothId";
                var parameters = new Dictionary<string, object>
                {
                    { "@UserId", userId },
                    { "@ToothId", toothId }
                };

                DataTable checkDt = DatabaseHelper.ExecuteQuery(checkQuery, parameters);
                string sql;
                var saveParams = new Dictionary<string, object>
                {
                    { "@UserId", userId },
                    { "@ToothId", toothId },
                    { "@MapId", mapId },
                    { "@Diagnostico", (object)diagnostico ?? DBNull.Value }
                };

                if (checkDt.Rows.Count > 0)
                {
                    // Update
                    sql = "UPDATE tbl_MapavsOdontograma SET id_MapaOdontograma = @MapId, Diagnostico = @Diagnostico WHERE id_Usuario = @UserId AND id_Diente = @ToothId";
                }
                else
                {
                    // Insert
                    sql = "INSERT INTO tbl_MapavsOdontograma (id_Usuario, id_Diente, id_MapaOdontograma, Diagnostico) VALUES (@UserId, @ToothId, @MapId, @Diagnostico)";
                }

                DatabaseHelper.ExecuteNonQuery(sql, saveParams);
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Tratamiento de diente guardado." });
                return;
            }

            if (path == "/api/odontograma/mapa" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_MapaOdontograma, Descripcion, Url, Acronimo FROM tbl_MapaOdontograma");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            // 6. HISTORIAL CLINICO (NOTAS MEDICAS / COMPARACIONES)
            if (path == "/api/historial" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                if (string.IsNullOrEmpty(userIdStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "id_usuario es requerido.");
                    return;
                }

                int userId = int.Parse(userIdStr);
                string query = "SELECT id_Nota, Fecha, Nota, Consentimiento, id_User, AntesImg, DespuesImg FROM tbl_NotaMedica WHERE id_User = @UserId ORDER BY Fecha DESC";
                DataTable dt = DatabaseHelper.ExecuteQuery(query, new Dictionary<string, object> { { "@UserId", userId } });
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/historial" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);
                string note = body["nota"]?.ToString();
                string consent = body["consentimiento"]?.ToString();
                string antesImg = body["antesImg"]?.ToString();
                string despuesImg = body["despuesImg"]?.ToString();

                if (string.IsNullOrEmpty(note))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "La nota médica es requerida.");
                    return;
                }

                string insertQuery = @"
                    INSERT INTO tbl_NotaMedica (Fecha, Nota, Consentimiento, id_User, AntesImg, DespuesImg)
                    VALUES (GETDATE(), @Nota, @Consentimiento, @UserId, @AntesImg, @DespuesImg)";

                var parameters = new Dictionary<string, object>
                {
                    { "@Nota", note },
                    { "@Consentimiento", consent },
                    { "@UserId", userId },
                    { "@AntesImg", antesImg },
                    { "@DespuesImg", despuesImg }
                };

                DatabaseHelper.ExecuteNonQuery(insertQuery, parameters);
                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Nota e historia clínica registrada." });
                return;
            }

            // 7. TRATAMIENTOS / PRESUPUESTOS
            if (path == "/api/tratamientos/paciente" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                if (string.IsNullOrEmpty(userIdStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "id_usuario es requerido.");
                    return;
                }

                int userId = int.Parse(userIdStr);
                string query = @"
                    SELECT tp.id_TratPaciente, tp.FechaIniTrat, tp.FechaFinTrat, tp.Presupuesto, t.id_Tratamiento, t.Tratamiento, ISNULL(tp.Monto, t.Monto) as Monto
                    FROM tbl_TratamientoPaciente tp
                    JOIN tbl_Tratamiento t ON tp.id_Tratamiento = t.id_Tratamiento
                    WHERE tp.id_User = @UserId
                    ORDER BY tp.FechaIniTrat DESC";

                DataTable dt = DatabaseHelper.ExecuteQuery(query, new Dictionary<string, object> { { "@UserId", userId } });
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/tratamientos/paciente" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);
                int treatmentId = Convert.ToInt32(body["id_tratamiento"]);
                bool isBudget = Convert.ToBoolean(body["presupuesto"]);
                
                decimal? customMonto = null;
                if (body.ContainsKey("monto") && body["monto"] != null)
                {
                    customMonto = Convert.ToDecimal(body["monto"]);
                }

                string query = @"
                    INSERT INTO tbl_TratamientoPaciente (FechaIniTrat, id_Tratamiento, id_User, Presupuesto, Monto)
                    VALUES (GETDATE(), @TreatmentId, @UserId, @Presupuesto, @Monto)";

                var parameters = new Dictionary<string, object>
                {
                    { "@TreatmentId", treatmentId },
                    { "@UserId", userId },
                    { "@Presupuesto", isBudget ? 1 : 0 },
                    { "@Monto", (object)customMonto ?? DBNull.Value }
                };

                DatabaseHelper.ExecuteNonQuery(query, parameters);
                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Tratamiento asignado correctamente." });
                return;
            }

            if (path == "/api/tratamientos/paciente/aprobar" && method == "POST")
            {
                var body = GetRequestBody(request);
                int idTratPaciente = Convert.ToInt32(body["id_TratPaciente"]);

                // Approves a budget (turns Presupuesto from 1 to 0)
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_TratamientoPaciente SET Presupuesto = 0 WHERE id_TratPaciente = @Id",
                    new Dictionary<string, object> { { "@Id", idTratPaciente } }
                );

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Presupuesto aprobado e iniciado como tratamiento." });
                return;
            }

            // 8. PAGOS Y DEUDAS
            if (path == "/api/pagos" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                if (string.IsNullOrEmpty(userIdStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "id_usuario es requerido.");
                    return;
                }

                int userId = int.Parse(userIdStr);
                string query = "SELECT id_Pago, Fecha, Monto, FirmaUrl, id_User, id_TratamientoPaciente FROM tbl_Pagos WHERE id_User = @UserId ORDER BY Fecha DESC";
                DataTable dt = DatabaseHelper.ExecuteQuery(query, new Dictionary<string, object> { { "@UserId", userId } });
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/pagos" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);
                decimal amount = Convert.ToDecimal(body["monto"]);
                string signature = body["firma"]?.ToString(); // Base64 signature
                int? idTratPaciente = body.ContainsKey("id_TratPaciente") && body["id_TratPaciente"] != null ? (int?)Convert.ToInt32(body["id_TratPaciente"]) : null;

                string query = @"
                    INSERT INTO tbl_Pagos (Fecha, Monto, FirmaUrl, id_User, id_TratamientoPaciente)
                    VALUES (GETDATE(), @Amount, @Signature, @UserId, @TratPacienteId)";

                var parameters = new Dictionary<string, object>
                {
                    { "@Amount", amount },
                    { "@Signature", signature },
                    { "@UserId", userId },
                    { "@TratPacienteId", idTratPaciente }
                };

                DatabaseHelper.ExecuteNonQuery(query, parameters);
                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Pago registrado correctamente." });
                return;
            }

            // 9. CALENDARIO / AGENDA INTELIGENTE
            if (path == "/api/citas" && method == "GET")
            {
                string userIdStr = request.QueryString["id_usuario"];
                string dateStr = request.QueryString["fecha"]; // Specific date YYYY-MM-DD
                string startStr = request.QueryString["inicio"];
                string endStr = request.QueryString["fin"];

                string query = @"
                    SELECT c.id_Cita, c.id_User, c.Fecha, c.Hora, c.Estado, c.Motivo, d.Nombre + ' ' + d.ApPat as PacienteNombre, d.Foto as PacienteFoto, t.Color as TipificacionColor
                    FROM tbl_Citas c
                    JOIN tbl_UsuarioDatos d ON c.id_User = d.id_Usuario
                    LEFT JOIN tbl_Tipificaciones t ON d.id_Tipificacion = t.id_Tipificacion
                    WHERE 1=1";

                var parameters = new Dictionary<string, object>();

                if (!string.IsNullOrEmpty(userIdStr))
                {
                    query += " AND c.id_User = @UserId";
                    parameters.Add("@UserId", int.Parse(userIdStr));
                }

                if (!string.IsNullOrEmpty(dateStr))
                {
                    query += " AND CAST(c.Fecha AS DATE) = CAST(@Date AS DATE)";
                    parameters.Add("@Date", DateTime.Parse(dateStr));
                }
                else if (!string.IsNullOrEmpty(startStr) && !string.IsNullOrEmpty(endStr))
                {
                    query += " AND c.Fecha BETWEEN @Start AND @End";
                    parameters.Add("@Start", DateTime.Parse(startStr));
                    parameters.Add("@End", DateTime.Parse(endStr));
                }

                query += " ORDER BY c.Fecha ASC, c.Hora ASC";

                DataTable dt = DatabaseHelper.ExecuteQuery(query, parameters);
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/citas" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_user"]);
                string dateStr = body["fecha"]?.ToString();
                string hour = body["hora"]?.ToString(); // HH:mm
                string motive = body["motivo"]?.ToString();

                DateTime date = DateTime.Parse(dateStr);

                // Validation 1: Check if date is in non-working days
                DataTable nonWorkingCheck = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_DiasNoLaborables WHERE CAST(Fecha AS DATE) = CAST(@Date AS DATE)",
                    new Dictionary<string, object> { { "@Date", date } }
                );

                if (nonWorkingCheck.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "La fecha seleccionada es un día NO laborable.");
                    return;
                }

                // Validation 2: Check if Sunday (no laborable)
                if (date.DayOfWeek == DayOfWeek.Sunday)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "Los domingos la clínica permanece cerrada.");
                    return;
                }

                // Validation 3: Check for duplicate slot
                DataTable duplicateCheck = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Citas WHERE CAST(Fecha AS DATE) = CAST(@Date AS DATE) AND Hora = @Hour AND Estado != 'cancelado'",
                    new Dictionary<string, object> { { "@Date", date }, { "@Hour", hour } }
                );

                if (duplicateCheck.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "Este horario ya se encuentra ocupado por otra cita.");
                    return;
                }

                string insertCita = @"
                    INSERT INTO tbl_Citas (id_User, Fecha, Hora, Estado, Motivo)
                    VALUES (@UserId, @Date, @Hour, 'espera', @Motive)";

                var parameters = new Dictionary<string, object>
                {
                    { "@UserId", userId },
                    { "@Date", date },
                    { "@Hour", hour },
                    { "@Motive", motive }
                };

                DatabaseHelper.ExecuteNonQuery(insertCita, parameters);
                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Cita agendada correctamente. Notificación automática enviada." });
                return;
            }

            if (path == "/api/citas/estado" && method == "PUT")
            {
                var body = GetRequestBody(request);
                int appointmentId = Convert.ToInt32(body["id_cita"]);
                string status = body["estado"]?.ToString(); // 'espera', 'atendido', 'cancelado'

                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Citas SET Estado = @Status WHERE id_Cita = @Id",
                    new Dictionary<string, object> { { "@Status", status }, { "@Id", appointmentId } }
                );

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Estado de cita actualizado correctamente." });
                return;
            }

            // 10. CONFIGURACIONES Y CATALOGOS
            if (path == "/api/config" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_SiteVar, Variable, Activo, Descripcion FROM tbl_SiteVariables");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/config" && method == "POST")
            {
                var body = GetRequestBody(request);
                foreach (var item in body)
                {
                    string varName = item.Key;
                    string varVal = item.Value?.ToString();

                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE tbl_SiteVariables SET Descripcion = @Val WHERE Variable = @Var",
                        new Dictionary<string, object> { { "@Val", varVal }, { "@Var", varName } }
                    );
                }

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Configuración del sitio guardada." });
                return;
            }

            if (path == "/api/catalogos/roles" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_Roll, Roll FROM tbl_Roles");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/catalogos/tipificaciones" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_Tipificacion, Nivel, Descripcion, Color FROM tbl_Tipificaciones");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/catalogos/tipificaciones" && method == "POST")
            {
                var body = GetRequestBody(request);
                string level = body["nivel"]?.ToString();
                string desc = body["descripcion"]?.ToString();
                string color = body["color"]?.ToString();

                // Check duplicate
                DataTable check = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Tipificaciones WHERE Nivel = @Level",
                    new Dictionary<string, object> { { "@Level", level } }
                );
                if (check.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.Conflict, "El nivel de tipificación ya existe.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO tbl_Tipificaciones (Nivel, Descripcion, Color) VALUES (@Level, @Desc, @Color)",
                    new Dictionary<string, object> { { "@Level", level }, { "@Desc", desc }, { "@Color", color } }
                );

                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Tipificación creada." });
                return;
            }

            if (path == "/api/catalogos/tipificaciones" && method == "PUT")
            {
                var body = GetRequestBody(request);
                int id = Convert.ToInt32(body["id_Tipificacion"]);
                string level = body["nivel"]?.ToString();
                string desc = body["descripcion"]?.ToString();
                string color = body["color"]?.ToString();

                // Check duplicate for other ids
                DataTable check = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Tipificaciones WHERE Nivel = @Level AND id_Tipificacion <> @Id",
                    new Dictionary<string, object> { { "@Level", level }, { "@Id", id } }
                );
                if (check.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.Conflict, "El nivel de tipificación ya existe.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Tipificaciones SET Nivel = @Level, Descripcion = @Desc, Color = @Color WHERE id_Tipificacion = @Id",
                    new Dictionary<string, object> { { "@Level", level }, { "@Desc", desc }, { "@Color", color }, { "@Id", id } }
                );
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Tipificación actualizada correctamente." });
                return;
            }

            if (path == "/api/catalogos/tipificaciones" && method == "DELETE")
            {
                string idStr = request.QueryString["id"];
                if (string.IsNullOrEmpty(idStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "ID es requerido.");
                    return;
                }
                int id = int.Parse(idStr);

                // Check if it is being used in user details
                DataTable checkUsage = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_UsuarioDatos WHERE id_Tipificacion = @Id",
                    new Dictionary<string, object> { { "@Id", id } }
                );
                if (checkUsage.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "No se puede eliminar la tipificación porque está asignada a pacientes.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "DELETE FROM tbl_Tipificaciones WHERE id_Tipificacion = @Id",
                    new Dictionary<string, object> { { "@Id", id } }
                );
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Tipificación eliminada correctamente." });
                return;
            }

            if (path == "/api/catalogos/dias_no_laborables" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_DiaNoLaborable, Fecha, Descripcion FROM tbl_DiasNoLaborables ORDER BY Fecha ASC");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/catalogos/dias_no_laborables" && method == "POST")
            {
                var body = GetRequestBody(request);
                string dateStr = body["fecha"]?.ToString();
                string desc = body["descripcion"]?.ToString();

                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO tbl_DiasNoLaborables (Fecha, Descripcion) VALUES (@Date, @Desc)",
                    new Dictionary<string, object> { { "@Date", DateTime.Parse(dateStr) }, { "@Desc", desc } }
                );

                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Día no laborable registrado." });
                return;
            }

            if (path == "/api/catalogos/tratamientos" && method == "GET")
            {
                DataTable dt = DatabaseHelper.ExecuteQuery("SELECT id_Tratamiento, Tratamiento, Monto FROM tbl_Tratamiento ORDER BY Tratamiento ASC");
                SendJsonResponse(response, HttpStatusCode.OK, dt.ToList());
                return;
            }

            if (path == "/api/catalogos/tratamientos" && method == "POST")
            {
                var body = GetRequestBody(request);
                string desc = body["tratamiento"]?.ToString();
                decimal price = Convert.ToDecimal(body["monto"]);

                // Check duplicate
                DataTable check = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Tratamiento WHERE Tratamiento = @Desc",
                    new Dictionary<string, object> { { "@Desc", desc } }
                );
                if (check.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.Conflict, "El tratamiento ya existe en el catálogo.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO tbl_Tratamiento (Tratamiento, Monto) VALUES (@Desc, @Price)",
                    new Dictionary<string, object> { { "@Desc", desc }, { "@Price", price } }
                );

                SendJsonResponse(response, HttpStatusCode.Created, new { message = "Tratamiento configurado correctamente." });
                return;
            }

            if (path == "/api/catalogos/tratamientos" && method == "PUT")
            {
                var body = GetRequestBody(request);
                int id = Convert.ToInt32(body["id_Tratamiento"]);
                string desc = body["tratamiento"]?.ToString();
                decimal price = Convert.ToDecimal(body["monto"]);

                // Check duplicate for other ids
                DataTable check = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Tratamiento WHERE Tratamiento = @Desc AND id_Tratamiento <> @Id",
                    new Dictionary<string, object> { { "@Desc", desc }, { "@Id", id } }
                );
                if (check.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.Conflict, "El tratamiento ya existe en el catálogo.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Tratamiento SET Tratamiento = @Desc, Monto = @Price WHERE id_Tratamiento = @Id",
                    new Dictionary<string, object> { { "@Desc", desc }, { "@Price", price }, { "@Id", id } }
                );
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Tratamiento actualizado correctamente." });
                return;
            }

            if (path == "/api/catalogos/tratamientos" && method == "DELETE")
            {
                string idStr = request.QueryString["id"];
                if (string.IsNullOrEmpty(idStr))
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "ID es requerido.");
                    return;
                }
                int id = int.Parse(idStr);

                // Check if it is being used in budgets/payments
                DataTable checkUsage = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_TratamientoPaciente WHERE id_Tratamiento = @Id",
                    new Dictionary<string, object> { { "@Id", id } }
                );
                if (checkUsage.Rows.Count > 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "No se puede eliminar el tratamiento porque está asignado a pacientes.");
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "DELETE FROM tbl_Tratamiento WHERE id_Tratamiento = @Id",
                    new Dictionary<string, object> { { "@Id", id } }
                );
                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Tratamiento eliminado correctamente." });
                return;
            }

            // 11. PASSWORD CHANGE FOR ACTIVE USER
            if (path == "/api/usuario/password" && method == "POST")
            {
                var body = GetRequestBody(request);
                int userId = Convert.ToInt32(body["id_usuario"]);
                string currentPass = body["current_pass"]?.ToString();
                string newPass = body["new_pass"]?.ToString();

                string encodedCurrent = Convert.ToBase64String(Encoding.Unicode.GetBytes(currentPass));
                DataTable check = DatabaseHelper.ExecuteQuery(
                    "SELECT 1 FROM tbl_Usuario WHERE id_Usuario = @Id AND Pass = @Pass",
                    new Dictionary<string, object> { { "@Id", userId }, { "@Pass", encodedCurrent } }
                );

                if (check.Rows.Count == 0)
                {
                    SendJsonError(response, HttpStatusCode.BadRequest, "La contraseña actual es incorrecta.");
                    return;
                }

                string encodedNew = Convert.ToBase64String(Encoding.Unicode.GetBytes(newPass));
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tbl_Usuario SET Pass = @Pass, FechaModificado = GETDATE() WHERE id_Usuario = @Id",
                    new Dictionary<string, object> { { "@Pass", encodedNew }, { "@Id", userId } }
                );

                SendJsonResponse(response, HttpStatusCode.OK, new { message = "Contraseña cambiada exitosamente." });
                return;
            }

            // 12. REPORTES
            if (path == "/api/reportes" && method == "GET")
            {
                // Patient registration growth (by month)
                string queryPatients = @"
                    SELECT FORMAT(FechaCreado, 'yyyy-MM') as Mes, COUNT(*) as Total
                    FROM tbl_Usuario u
                    JOIN tbl_UsuarioDatos d ON u.id_Usuario = d.id_Usuario
                    WHERE d.id_Roll = 5 AND u.Activo = 1
                    GROUP BY FORMAT(FechaCreado, 'yyyy-MM')
                    ORDER BY Mes ASC";
                DataTable dtPatients = DatabaseHelper.ExecuteQuery(queryPatients);

                // Appointments status counts
                string queryAppointments = @"
                    SELECT Estado, COUNT(*) as Total
                    FROM tbl_Citas
                    GROUP BY Estado";
                DataTable dtAppointments = DatabaseHelper.ExecuteQuery(queryAppointments);

                // Payments (Income)
                string queryPayments = @"
                    SELECT FORMAT(Fecha, 'yyyy-MM-dd') as Dia, SUM(Monto) as Total
                    FROM tbl_Pagos
                    GROUP BY FORMAT(Fecha, 'yyyy-MM-dd')";
                DataTable dtPayments = DatabaseHelper.ExecuteQuery(queryPayments);

                var reportData = new Dictionary<string, object>
                {
                    { "pacientesCrecimiento", dtPatients.ToList() },
                    { "citasResumen", dtAppointments.ToList() },
                    { "ingresosPorDia", dtPayments.ToList() },
                    { "egresos", new List<object> { new { Descripcion = "Materiales", Monto = 1200 }, new { Descripcion = "Renta Consultorio", Monto = 5000 } } } // Demo/Egresos standard list
                };

                SendJsonResponse(response, HttpStatusCode.OK, reportData);
                return;
            }

            SendJsonError(response, HttpStatusCode.NotFound, "Ruta de API no encontrada.");
        }

        private static Dictionary<string, object> GetRequestBody(HttpListenerRequest request)
        {
            var encoding = request.ContentEncoding ?? Encoding.UTF8;
            using (var reader = new StreamReader(request.InputStream, encoding))
            {
                string bodyStr = reader.ReadToEnd();
                if (string.IsNullOrEmpty(bodyStr)) return new Dictionary<string, object>();
                return JsonConvert.DeserializeObject<Dictionary<string, object>>(bodyStr);
            }
        }

        private static void SendJsonResponse(HttpListenerResponse response, HttpStatusCode statusCode, object data)
        {
            string json = JsonConvert.SerializeObject(data);
            byte[] buffer = Encoding.UTF8.GetBytes(json);
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = buffer.Length;
            response.StatusCode = (int)statusCode;
            response.OutputStream.Write(buffer, 0, buffer.Length);
            response.Close();
        }

        private static void SendJsonError(HttpListenerResponse response, HttpStatusCode statusCode, string errorMessage)
        {
            SendJsonResponse(response, statusCode, new { error = errorMessage });
        }

        private static string GetContentType(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".svg": return "image/svg+xml";
                case ".json": return "application/json; charset=utf-8";
                case ".ico": return "image/x-icon";
                default: return "application/octet-stream";
            }
        }
    }
}
