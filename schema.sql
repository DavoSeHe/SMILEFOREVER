-- SQL Server database schema and seeds for ClinicaDental
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ClinicaDental')
BEGIN
    CREATE DATABASE [ClinicaDental];
END
GO

USE [ClinicaDental];
GO

-- Drop tables if they exist to allow clean reinstall
IF OBJECT_ID('dbo.tbl_Citas', 'U') IS NOT NULL DROP TABLE dbo.tbl_Citas;
IF OBJECT_ID('dbo.tbl_DiasNoLaborables', 'U') IS NOT NULL DROP TABLE dbo.tbl_DiasNoLaborables;
IF OBJECT_ID('dbo.tbl_Tipificaciones', 'U') IS NOT NULL DROP TABLE dbo.tbl_Tipificaciones;
IF OBJECT_ID('dbo.tbl_AntecedentesFamiliares', 'U') IS NOT NULL DROP TABLE dbo.tbl_AntecedentesFamiliares;
IF OBJECT_ID('dbo.tbl_AntecedentesPersonales', 'U') IS NOT NULL DROP TABLE dbo.tbl_AntecedentesPersonales;
IF OBJECT_ID('dbo.tbl_CostosUsuario', 'U') IS NOT NULL DROP TABLE dbo.tbl_CostosUsuario;
IF OBJECT_ID('dbo.tbl_Costos', 'U') IS NOT NULL DROP TABLE dbo.tbl_Costos;
IF OBJECT_ID('dbo.tbl_MapavsOdontograma', 'U') IS NOT NULL DROP TABLE dbo.tbl_MapavsOdontograma;
IF OBJECT_ID('dbo.tbl_Odontograma', 'U') IS NOT NULL DROP TABLE dbo.tbl_Odontograma;
IF OBJECT_ID('dbo.tbl_MapaOdontograma', 'U') IS NOT NULL DROP TABLE dbo.tbl_MapaOdontograma;
IF OBJECT_ID('dbo.tbl_Menu_Roll', 'U') IS NOT NULL DROP TABLE dbo.tbl_Menu_Roll;
IF OBJECT_ID('dbo.tbl_Menu', 'U') IS NOT NULL DROP TABLE dbo.tbl_Menu;
IF OBJECT_ID('dbo.tbl_menu_old', 'U') IS NOT NULL DROP TABLE dbo.tbl_menu_old;
IF OBJECT_ID('dbo.tbl_NotaMedica', 'U') IS NOT NULL DROP TABLE dbo.tbl_NotaMedica;
IF OBJECT_ID('dbo.tbl_Pagos', 'U') IS NOT NULL DROP TABLE dbo.tbl_Pagos;
IF OBJECT_ID('dbo.tbl_Patologias', 'U') IS NOT NULL DROP TABLE dbo.tbl_Patologias;
IF OBJECT_ID('dbo.tbl_UsuarioDatos', 'U') IS NOT NULL DROP TABLE dbo.tbl_UsuarioDatos;
IF OBJECT_ID('dbo.tbl_Roles', 'U') IS NOT NULL DROP TABLE dbo.tbl_Roles;
IF OBJECT_ID('dbo.tbl_SiteVariables', 'U') IS NOT NULL DROP TABLE dbo.tbl_SiteVariables;
IF OBJECT_ID('dbo.tbl_TratamientoPaciente', 'U') IS NOT NULL DROP TABLE dbo.tbl_TratamientoPaciente;
IF OBJECT_ID('dbo.tbl_Tratamiento', 'U') IS NOT NULL DROP TABLE dbo.tbl_Tratamiento;
IF OBJECT_ID('dbo.tbl_Usuario', 'U') IS NOT NULL DROP TABLE dbo.tbl_Usuario;
IF OBJECT_ID('dbo.sp_ConsultaOdontograma', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ConsultaOdontograma;
GO

-- 1. tbl_Roles
CREATE TABLE [dbo].[tbl_Roles](
	[id_Roll] [int] NOT NULL PRIMARY KEY,
	[Roll] [varchar](30) NULL
) ON [PRIMARY];
GO

-- 2. tbl_Tipificaciones (Extension)
CREATE TABLE [dbo].[tbl_Tipificaciones](
	[id_Tipificacion] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
	[Nivel] [varchar](50) NOT NULL,
	[Descripcion] [varchar](500) NULL,
	[Color] [varchar](10) NOT NULL
) ON [PRIMARY];
GO

-- 3. tbl_Usuario
CREATE TABLE [dbo].[tbl_Usuario](
	[id_Usuario] [int] NOT NULL PRIMARY KEY,
	[Email] [varchar](50) NULL,
	[Telefono] [int] NULL,
	[Pass] [varchar](300) NOT NULL,
	[FechaCreado] [datetime] NOT NULL,
	[FechaModificado] [datetime] NOT NULL,
	[Activo] [int] NOT NULL,
	[Temporal] [bit] NOT NULL
) ON [PRIMARY];
GO

-- 4. tbl_UsuarioDatos (Extended with Foto and id_Tipificacion)
CREATE TABLE [dbo].[tbl_UsuarioDatos](
	[id_Usuario] [int] NOT NULL PRIMARY KEY,
	[Nombre] [varchar](50) NOT NULL,
	[ApPat] [varchar](30) NOT NULL,
	[ApMat] [varchar](30) NOT NULL,
	[Sexo] [varchar](10) NOT NULL,
	[Ocupacion] [varchar](50) NULL,
	[FechaNat] [datetime] NULL,
	[Domicilio] [varchar](300) NULL,
	[Email] [varchar](50) NULL,
	[Telefono] [numeric](15, 0) NULL,
	[TelefonoEmergencia] [varchar](500) NULL,
	[MotivoConsulta] [varchar](500) NULL,
	[id_Roll] [int] NOT NULL,
	[Observaciones] [varchar](4000) NULL,
	[Foto] [varchar](max) NULL, -- Extension for patient photo
	[id_Tipificacion] [int] NULL -- Extension for patient typification
) ON [PRIMARY];
GO

-- 5. tbl_AntecedentesFamiliares
CREATE TABLE [dbo].[tbl_AntecedentesFamiliares](
	[id_AntecedenteFam] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
	[Madre] [varchar](30) NULL,
	[AbuelaMat] [varchar](30) NULL,
	[AbueloMat] [varchar](30) NULL,
	[OtrosMat] [varchar](100) NULL,
	[Padre] [varchar](30) NULL,
	[AbuelaPat] [varchar](30) NULL,
	[AbueloPat] [varchar](30) NULL,
	[OtrosPat] [varchar](100) NULL,
	[Hermanos] [varchar](30) NULL,
	[Id_user] [int] NOT NULL
) ON [PRIMARY];
GO

-- 6. tbl_AntecedentesPersonales
CREATE TABLE [dbo].[tbl_AntecedentesPersonales](
	[id_AntecedentePersonal] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
	[Id_Patologia] [varchar](50) NULL,
	[Id_user] [int] NOT NULL
) ON [PRIMARY];
GO

-- 7. tbl_Costos
CREATE TABLE [dbo].[tbl_Costos](
	[id_Costo] [int] NOT NULL PRIMARY KEY,
	[Descripcion] [varchar](100) NOT NULL,
	[Monto] [decimal](18, 2) NOT NULL
) ON [PRIMARY];
GO

-- 8. tbl_CostosUsuario
CREATE TABLE [dbo].[tbl_CostosUsuario](
	[id_Costo] [int] NULL,
	[id_User] [int] NULL,
	[Fecha] [datetime] NULL
) ON [PRIMARY];
GO

-- 9. tbl_MapaOdontograma
CREATE TABLE [dbo].[tbl_MapaOdontograma](
	[id_MapaOdontograma] [int] NOT NULL PRIMARY KEY,
	[Descripcion] [varchar](500) NOT NULL,
	[Url] [varchar](999) NOT NULL,
	[Acronimo] [varchar](20) NULL
) ON [PRIMARY];
GO

-- 10. tbl_MapavsOdontograma
CREATE TABLE [dbo].[tbl_MapavsOdontograma](
	[id_Usuario] [int] NULL,
	[id_Diente] [int] NULL,
	[id_MapaOdontograma] [int] NULL
) ON [PRIMARY];
GO

-- 11. tbl_Menu
CREATE TABLE [dbo].[tbl_Menu](
	[id_menu] [int] NOT NULL PRIMARY KEY,
	[Menu] [varchar](100) NOT NULL,
	[Cadena] [varchar](1000) NOT NULL,
	[idPadre] [int] NULL
) ON [PRIMARY];
GO

-- 12. tbl_menu_old
CREATE TABLE [dbo].[tbl_menu_old](
	[id_menu] [int] NOT NULL PRIMARY KEY,
	[Menu] [varchar](100) NOT NULL,
	[class] [varchar](250) NOT NULL,
	[idhtml] [varchar](10) NOT NULL,
	[data_toggle] [varchar](50) NULL,
	[data_target] [varchar](50) NULL,
	[Activo] [bit] NOT NULL,
	[OnClick] [varchar](30) NULL,
	[idPadre] [int] NULL
) ON [PRIMARY];
GO

-- 13. tbl_Menu_Roll
CREATE TABLE [dbo].[tbl_Menu_Roll](
	[id_Menu] [int] NULL,
	[id_Roll] [int] NULL
) ON [PRIMARY];
GO

-- 14. tbl_NotaMedica (Extended with AntesImg and DespuesImg)
CREATE TABLE [dbo].[tbl_NotaMedica](
	[id_Nota] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY, -- changed to IDENTITY
	[Fecha] [datetime] NOT NULL,
	[Nota] [varchar](2000) NOT NULL,
	[Consentimiento] [varchar](2000) NULL,
	[id_User] [int] NOT NULL,
	[AntesImg] [varchar](max) NULL, -- Base64 before image
	[DespuesImg] [varchar](max) NULL -- Base64 after image
) ON [PRIMARY];
GO

-- 15. tbl_Odontograma
CREATE TABLE [dbo].[tbl_Odontograma](
	[id_Odontograma] [int] NOT NULL PRIMARY KEY,
	[id_Diente] [int] NOT NULL,
	[Formato] [bit] NULL,
	[id_MapaOdontograma] [int] NULL,
	[nivel] [varchar](10) NULL
) ON [PRIMARY];
GO

-- 16. tbl_Pagos
CREATE TABLE [dbo].[tbl_Pagos](
	[id_Pago] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY, -- changed to IDENTITY
	[Fecha] [datetime] NOT NULL,
	[Monto] [decimal](12, 2) NOT NULL,
	[FirmaUrl] [varchar](max) NULL, -- Stores base64 signature representation
	[id_User] [int] NOT NULL,
	[id_TratamientoPaciente] [int] NULL -- Link to treatment
) ON [PRIMARY];
GO

-- 17. tbl_Patologias
CREATE TABLE [dbo].[tbl_Patologias](
	[id_Patologia] [int] NOT NULL PRIMARY KEY,
	[Patologia] [varchar](100) NOT NULL,
	[AntFamiliar] [int] NULL
) ON [PRIMARY];
GO

-- 18. tbl_SiteVariables
CREATE TABLE [dbo].[tbl_SiteVariables](
	[id_SiteVar] [int] NOT NULL PRIMARY KEY,
	[Variable] [varchar](50) NOT NULL,
	[Activo] [bit] NULL,
	[Descripcion] [varchar](500) NULL
) ON [PRIMARY];
GO

-- 19. tbl_Tratamiento
CREATE TABLE [dbo].[tbl_Tratamiento](
	[id_Tratamiento] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY, -- changed to IDENTITY
	[Tratamiento] [varchar](100) NOT NULL, -- changed description type to varchar
	[Monto] [decimal](12, 2) NOT NULL
) ON [PRIMARY];
GO

-- 20. tbl_TratamientoPaciente
CREATE TABLE [dbo].[tbl_TratamientoPaciente](
	[id_TratPaciente] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY, -- changed to IDENTITY
	[FechaIniTrat] [datetime] NOT NULL,
	[FechaFinTrat] [datetime] NULL,
	[id_Tratamiento] [int] NOT NULL,
	[id_User] [int] NOT NULL,
	[Presupuesto] [bit] NOT NULL DEFAULT 1 -- 1 for budget, 0 for active/done treatment
) ON [PRIMARY];
GO

-- 21. tbl_Citas (Extension)
CREATE TABLE [dbo].[tbl_Citas](
	[id_Cita] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
	[id_User] [int] NOT NULL,
	[Fecha] [datetime] NOT NULL,
	[Hora] [varchar](10) NOT NULL,
	[Estado] [varchar](30) NOT NULL, -- 'espera', 'atendido', 'cancelado'
	[Motivo] [varchar](500) NULL
) ON [PRIMARY];
GO

-- 22. tbl_DiasNoLaborables (Extension)
CREATE TABLE [dbo].[tbl_DiasNoLaborables](
	[id_DiaNoLaborable] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
	[Fecha] [datetime] NOT NULL,
	[Descripcion] [varchar](250) NULL
) ON [PRIMARY];
GO


-- SEEDS SECCION
-- Roles
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (1, N'Doctora_Admin')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (2, N'Doctora')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (3, N'Asistente_Admin')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (4, N'Asistente')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (5, N'Paciente')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (6, N'Super Admin')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (7, N'Admin')
INSERT [dbo].[tbl_Roles] ([id_Roll], [Roll]) VALUES (8, N'Configurador')
GO

-- Tipificaciones
SET IDENTITY_INSERT [dbo].[tbl_Tipificaciones] ON;
INSERT [dbo].[tbl_Tipificaciones] ([id_Tipificacion], [Nivel], [Descripcion], [Color]) VALUES (1, N'Verde', N'Sano o antecedentes menores', N'#28a745')
INSERT [dbo].[tbl_Tipificaciones] ([id_Tipificacion], [Nivel], [Descripcion], [Color]) VALUES (2, N'Amarillo', N'Cuidado preventivo / antecedentes leves', N'#ffc107')
INSERT [dbo].[tbl_Tipificaciones] ([id_Tipificacion], [Nivel], [Descripcion], [Color]) VALUES (3, N'Naranja', N'Riesgo moderado / antecedentes de HTA o Cardiopatía', N'#fd7e14')
INSERT [dbo].[tbl_Tipificaciones] ([id_Tipificacion], [Nivel], [Descripcion], [Color]) VALUES (4, N'Rojo', N'Alto riesgo / antecedentes críticos o múltiples', N'#dc3545')
SET IDENTITY_INSERT [dbo].[tbl_Tipificaciones] OFF;
GO

-- MapaOdontograma
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (1, N'Rojo = Caries', N'img/Caries.PNG', N'Carie')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (2, N'Giroversión', N'img/Giroversion.PNG', N'Girov')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (3, N'Incluido', N'img/Incluido.PNG', N'Inclu')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (4, N'Perdido', N'img/Perdido.PNG', N'Perdi')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (5, N'Erosión', N'img/Erosion.PNG', N'Erosi')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (6, N'Supernumerario', N'img/Supernumerario.PNG', N'Super')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (7, N'Obturado', N'img/Obturado.PNG', N'Obtur')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (8, N'Abrasión', N'img/Abrasion.PNG', N'Abras')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (9, N'Pulpectomía', N'img/Pulpectomia.PNG', N'Pulpe')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (10, N'Bolsa periodontal', N'img/Bolsa_periodontal.PNG', N'Bolsa')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (11, N'Prótesis fija', N'img/Protesis_fija.PNG', N'Prote')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (12, N'Movilidad (especificar el grado)', N'img/Movilidad.PNG', N'Movil')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (13, N'Órgano no vital', N'img/Organo_no_vital.PNG', N'Organ')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (14, N'Prótesis removible', N'img/Protesis_removible.PNG', N'Remov')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (15, N'Otro (especificar)', N'img/Otro.PNG', N'Otros')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (16, N'Diastema', N'img/Diastema.PNG', N'Diast')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (17, N'Diente', N'img/Diente.PNG', N'Dient')
INSERT [dbo].[tbl_MapaOdontograma] ([id_MapaOdontograma], [Descripcion], [Url], [Acronimo]) VALUES (18, N'Muela', N'img/Muela.PNG', N'Muela')
GO

-- Menu
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (1, N'Pacientes', N'<a href=''#'' class=''nav-link dropdown-toggle'' id=''aPac'' data-toggle=''dropdown'' role=''button'' aria-haspopup=''true'' aria-expanded=''false''>Pacientes</a>', 0)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (2, N'Calendario', N'<a href=''#'' class=''nav-link'' id=''aCal'' data-toggle=''modal'' data-target=''#CalendarioModal''>Calendario</a>', 0)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (3, N'Reportes', N'<a href=''#'' class=''nav-link dropdown-toggle'' id=''aRep'' data-toggle=''dropdown'' role=''button'' aria-haspopup=''true'' aria-expanded=''false''>Reportes</a>', 0)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (4, N'Perfil', N'<a href=''#'' class=''nav-link dropdown-toggle'' id=''aPer'' data-toggle=''dropdown'' role=''button'' aria-haspopup=''true'' aria-expanded=''false''>{Perfil}</a>', 0)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (5, N'NoPaciente', N'<a href=''#'' class=''dropdown-item''>No. Pacientes</a>', 3)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (6, N'Entradas', N'<a href=''#'' class=''dropdown-item''>Entradas</a>', 3)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (7, N'Gastos', N'<a href=''#'' class=''dropdown-item''>Gastos</a>', 3)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (8, N'Configuraciones', N'<a  href=''#'' class=''dropdown-item''>Configuraciones</a>', 4)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (9, N'CambioContraseña', N'<a  href=''#'' class=''dropdown-item''>Cambiar contraseña</a>', 4)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (10, N'Salir', N'<a  href=''#'' class=''dropdown-item''>Salir</a>', 4)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (1002, N'Nuevo paciente', N'<a href=''#'' class=''dropdown-item'' onClick=''f_btnNewPatient()''>Nuevo paciente</a>', 1)
INSERT [dbo].[tbl_Menu] ([id_menu], [Menu], [Cadena], [idPadre]) VALUES (1003, N'Buscar paciente', N'<a href=''#'' class=''dropdown-item''>Buscar paciente</a>', 1)
GO

-- Menu Roll
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (1, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (2, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (3, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (4, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (5, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (6, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (7, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (8, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (9, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (10, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (1002, 1)
INSERT [dbo].[tbl_Menu_Roll] ([id_Menu], [id_Roll]) VALUES (1003, 1)
GO

-- Odontograma
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (1, 18, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (2, 17, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (3, 16, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (4, 15, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (5, 14, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (6, 13, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (7, 12, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (8, 11, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (9, 21, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (10, 22, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (11, 23, 1, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (12, 24, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (13, 25, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (14, 26, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (15, 27, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (16, 28, 1, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (17, 55, 0, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (18, 54, 0, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (19, 53, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (20, 52, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (21, 51, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (22, 61, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (23, 62, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (24, 63, 0, 17, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (25, 64, 0, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (26, 65, 0, 18, N'Superior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (27, 85, 0, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (28, 84, 0, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (29, 83, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (30, 82, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (31, 81, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (32, 71, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (33, 72, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (34, 73, 0, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (35, 74, 0, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (36, 75, 0, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (37, 48, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (38, 47, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (39, 46, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (40, 45, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (41, 44, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (42, 43, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (43, 42, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (44, 41, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (45, 31, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (46, 32, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (47, 33, 1, 17, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (48, 34, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (49, 35, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (50, 36, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (51, 37, 1, 18, N'Inferior')
INSERT [dbo].[tbl_Odontograma] ([id_Odontograma], [id_Diente], [Formato], [id_MapaOdontograma], [nivel]) VALUES (52, 38, 1, 18, N'Inferior')
GO

-- Patologias
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (1, N'Diabetes', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (2, N'HTA', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (3, N'Cardiopatías', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (4, N'Neoplasias', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (5, N'Epilepsia', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (6, N'Malformaciones', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (7, N'SIDA', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (8, N'ER', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (9, N'Hepatitis', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (10, N'Artritis', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (11, N'Otra', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (12, N'Sano', 1)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (13, N'Varicela', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (14, N'Rubéola', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (15, N'Sarampión', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (16, N'Parotiditis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (17, N'Tosferina', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (18, N'Escarlatina', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (19, N'Parasitosis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (20, N'Hepatitis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (21, N'SIDA', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (22, N'Asma', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (23, N'Disfunciones', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (24, N'Hipertensión', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (25, N'Cáncer', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (26, N'Transm_Sex', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (27, N'Epilepsia', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (28, N'Amigdalitis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (29, N'Tuberculosis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (30, N'Fiebre_reumática', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (31, N'Diabetes', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (32, N'Enf_Cardiovasculares', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (33, N'Artritis', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (34, N'Traumatismos', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (35, N'Intervenciones', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (36, N'Transfusiones', 0)
INSERT [dbo].[tbl_Patologias] ([id_Patologia], [Patologia], [AntFamiliar]) VALUES (37, N'Alergias', 0)
GO

-- Site Variables
INSERT [dbo].[tbl_SiteVariables] ([id_SiteVar], [Variable], [Activo], [Descripcion]) VALUES (1, N'NombreSitio', 1, N'Futura Sonrisa')
INSERT [dbo].[tbl_SiteVariables] ([id_SiteVar], [Variable], [Activo], [Descripcion]) VALUES (2, N'Logo', 1, N'')
INSERT [dbo].[tbl_SiteVariables] ([id_SiteVar], [Variable], [Activo], [Descripcion]) VALUES (3, N'ColorPrimario', 1, N'#0d6efd') -- Default Bootstrap Blue
INSERT [dbo].[tbl_SiteVariables] ([id_SiteVar], [Variable], [Activo], [Descripcion]) VALUES (4, N'ColorSecundario', 1, N'#198754') -- Default Bootstrap Green
INSERT [dbo].[tbl_SiteVariables] ([id_SiteVar], [Variable], [Activo], [Descripcion]) VALUES (5, N'Fondo', 1, N'#f8f9fa') -- Light Gray Background
GO

-- Usuario
INSERT [dbo].[tbl_Usuario] ([id_Usuario], [Email], [Telefono], [Pass], [FechaCreado], [FechaModificado], [Activo], [Temporal]) VALUES (1, N'DoctoraAngela@email.com', 1234567890, N'MQAyADMANAA1ADYANwA4ADkA', CAST(N'2021-07-13T08:27:16.650' AS DateTime), CAST(N'2021-07-13T08:27:16.650' AS DateTime), 1, 0)
GO

-- Usuario Datos (id_Roll = 1 is Doctora_Admin)
INSERT [dbo].[tbl_UsuarioDatos] ([id_Usuario], [Nombre], [ApPat], [ApMat], [Sexo], [Ocupacion], [FechaNat], [Domicilio], [Email], [Telefono], [TelefonoEmergencia], [MotivoConsulta], [id_Roll], [Observaciones], [Foto], [id_Tipificacion]) VALUES (1, N'Angela', N'Arellano', N'Roque', N'Mujer', NULL, NULL, NULL, N'DoctoraAngela@email.com', CAST(1234567890 AS Numeric(15, 0)), NULL, NULL, 1, NULL, NULL, NULL)
GO

-- Seed some default Treatments (tbl_Tratamiento)
SET IDENTITY_INSERT [dbo].[tbl_Tratamiento] ON;
INSERT [dbo].[tbl_Tratamiento] ([id_Tratamiento], [Tratamiento], [Monto]) VALUES (1, N'Limpieza Dental Profunda', 600.00)
INSERT [dbo].[tbl_Tratamiento] ([id_Tratamiento], [Tratamiento], [Monto]) VALUES (2, N'Resina Estética de Fotocurado', 850.00)
INSERT [dbo].[tbl_Tratamiento] ([id_Tratamiento], [Tratamiento], [Monto]) VALUES (3, N'Endodoncia Monorradicular', 2500.00)
INSERT [dbo].[tbl_Tratamiento] ([id_Tratamiento], [Tratamiento], [Monto]) VALUES (4, N'Extracción Dental Simple', 500.00)
INSERT [dbo].[tbl_Tratamiento] ([id_Tratamiento], [Tratamiento], [Monto]) VALUES (5, N'Corona de Porcelana', 4500.00)
SET IDENTITY_INSERT [dbo].[tbl_Tratamiento] OFF;
GO

-- Stored Procedure
CREATE PROCEDURE [dbo].[sp_ConsultaOdontograma]
@Formato int,
@id_usuario int
AS 
BEGIN
	IF @id_usuario = 0 
		begin
			SELECT o.id_Diente, mo.id_MapaOdontograma, mo.Descripcion, mo.Url, o.nivel
			FROM tbl_Odontograma o
			JOIN tbl_MapaOdontograma mo ON o.id_MapaOdontograma = mo.id_MapaOdontograma
			WHERE Formato = @Formato
			ORDER BY o.nivel, id_Odontograma;
		end
	ELSE
		begin
			SELECT o.id_Diente, mo.id_MapaOdontograma, mo.Descripcion, mo.Url, o.nivel
			FROM tbl_Odontograma o
			JOIN tbl_MapaOdontograma mo ON o.id_MapaOdontograma = mo.id_MapaOdontograma
			JOIN tbl_MapavsOdontograma mvo ON o.id_Diente = mvo.id_Diente 
			AND mo.id_MapaOdontograma = mvo.id_MapaOdontograma
			WHERE Formato = @Formato AND mvo.id_Usuario = @id_usuario
			ORDER BY o.nivel, id_Odontograma;
		end
END
GO
