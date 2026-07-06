// Clinica Dental - Application Frontend Logic
$(document).ready(function() {
    // Application State
    let currentUser = null;
    let activePatient = null;
    let activeView = "dashboard";
    let selectedTooth = null;
    let selectedRelative = "Paciente";
    
    // Pathology status structure
    let patientPathologies = {
        personales: [], // list of pathology names
        familiares: {}  // relative -> pathology mapping
    };

    // Calendar state
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    let nonWorkingDays = []; // dates blocked from DB
    
    // Signature canvas state
    let canvas = document.getElementById("payment-signature-canvas");
    let ctx = canvas.getContext("2d");
    let isDrawingSignature = false;

    // Charts objects
    let chartPatients = null;
    let chartAppts = null;
    let chartFinances = null;

    // INITIALIZATION
    function init() {
        setupEventListeners();
        loadSiteSettings();
        checkSession();
        setupSignaturePad();
    }

    // SESSION MANAGEMENT
    function checkSession() {
        $.ajax({
            url: "/api/session",
            method: "GET",
            dataType: "json",
            success: function(user) {
                loginUser(user);
            },
            error: function() {
                showView("login");
            }
        });
    }

    function loginUser(user) {
        currentUser = user;
        
        // Save current user image or fallback
        let avatar = user.Foto || MOCK_IMAGES.avatar;
        $("#user-avatar").attr("src", avatar);
        $("#user-display-name").text(user.Nombre + " " + user.ApPat);
        $("#user-display-role").text(user.Roll);
        
        // Manage profile access (Doctora_Admin, Doctora, Asistente, Paciente, etc.)
        // Roles: 1 (Doctora_Admin), 2 (Doctora), 3 (Asistente_Admin), 4 (Asistente), 5 (Paciente), 6 (Super Admin), 7 (Admin)
        let roleId = parseInt(user.id_Roll);
        
        if (roleId === 5) {
            // Patient view
            $(".view-staff-only").addClass("d-none");
            $("#patient-search-container").addClass("d-none");
            
            // Auto select patient context as oneself
            selectPatientContext({
                id_Usuario: user.id_Usuario,
                Nombre: user.Nombre,
                ApPat: user.ApPat,
                ApMat: user.ApMat,
                Foto: user.Foto,
                id_Tipificacion: user.id_Tipificacion,
                TipificacionColor: user.TipificacionColor || "#28a745"
            });
            $("#btn-clear-patient-context").addClass("d-none"); // Patient cannot clear own context
        } else {
            // Doctor / Assistant view
            $(".view-staff-only").removeClass("d-none");
            $("#patient-search-container").removeClass("d-none");
            $("#btn-clear-patient-context").removeClass("d-none");
        }

        loadSiteSettings();
        loadCatalogs();
        
        showView("dashboard");
        loadDashboardStats();
    }

    // LOAD DYNAMIC CONFIG & THEMES
    function loadSiteSettings() {
        $.ajax({
            url: "/api/config",
            method: "GET",
            dataType: "json",
            success: function(vars) {
                let siteName = "Futura Sonrisa";
                let primaryColor = "#0d6efd";
                let secondaryColor = "#198754";
                let fondo = "#f8f9fa";
                let logo = MOCK_IMAGES.logo;

                vars.forEach(v => {
                    if (v.Variable === "NombreSitio" && v.Descripcion) siteName = v.Descripcion;
                    if (v.Variable === "ColorPrimario" && v.Descripcion) primaryColor = v.Descripcion;
                    if (v.Variable === "ColorSecundario" && v.Descripcion) secondaryColor = v.Descripcion;
                    if (v.Variable === "Fondo" && v.Descripcion) fondo = v.Descripcion;
                    if (v.Variable === "Logo" && v.Descripcion) logo = v.Descripcion;
                });

                // Apply custom styles
                document.documentElement.style.setProperty('--primary-color', primaryColor);
                document.documentElement.style.setProperty('--secondary-color', secondaryColor);
                document.documentElement.style.setProperty('--background-color', fondo);
                
                // Set images & titles
                $("#login-logo, #sidebar-logo, #dental-loader-logo-large").attr("src", logo);
                $("#login-site-name, #sidebar-site-name, #dash-card-site-name, #dashboard-clinic-name, #dental-loader-site-name").text(siteName);
                
                // Form config inputs defaults
                $("#config-site-name").val(siteName);
                $("#config-primary-color").val(primaryColor);
                $("#config-secondary-color").val(secondaryColor);
                $("#config-bg-color").val(fondo);
                $("#config-logo-base64").val(logo);
            }
        });
    }

    // NAVIGATION
    function showView(viewName) {
        activeView = viewName;
        $(".app-view").addClass("d-none");
        $("#view-login").addClass("d-none");
        $("#app-container").addClass("d-none");

        if (viewName === "login") {
            $("#view-login").removeClass("d-none");
            return;
        }

        $("#app-container").removeClass("d-none");
        $("#view-" + viewName).removeClass("d-none");

        // Sidebar active class
        $(".sidebar .nav-link").removeClass("active");
        $(`.sidebar .nav-link[data-view="${viewName}"]`).addClass("active");

        // View title
        let titles = {
            dashboard: "Dashboard Principal",
            registro: "Registro de Usuarios y Pacientes",
            patologias: "Antecedentes Patológicos",
            odontograma: "Tratamiento e Historial Clínico",
            presupuestos: "Presupuestos y Pagos",
            agenda: "Agenda Inteligente de Citas",
            reportes: "Reportes Clínicos y Financieros",
            catalogos: "Configuración y Catálogos"
        };
        $("#current-view-title").text(titles[viewName] || "Clínica Dental");

        // Run custom loaders per view
        if (viewName === "registro") loadUsersList();
        if (viewName === "patologias") loadPatologiasView();
        if (viewName === "odontograma") loadOdontogramaView();
        if (viewName === "presupuestos") loadPresupuestosView();
        if (viewName === "agenda") loadAgendaView();
        if (viewName === "reportes") loadReportesView();
        if (viewName === "catalogos") loadCatalogosView();
    }

    // SIGNATURE PAD
    function setupSignaturePad() {
        if (!canvas) return;

        function resizeCanvas() {
            // Get correct element dimensions
            let rect = canvas.parentNode.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = 180;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#000000";
        }
        
        window.addEventListener("resize", resizeCanvas);
        // Delay slightly for initial sizing
        setTimeout(resizeCanvas, 300);

        function getMousePos(e) {
            let rect = canvas.getBoundingClientRect();
            let clientX = e.clientX || (e.touches && e.touches[0].clientX);
            let clientY = e.clientY || (e.touches && e.touches[0].clientY);
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        function startDrawing(e) {
            isDrawingSignature = true;
            let pos = getMousePos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            e.preventDefault();
        }

        function draw(e) {
            if (!isDrawingSignature) return;
            let pos = getMousePos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            e.preventDefault();
        }

        function stopDrawing() {
            isDrawingSignature = false;
            ctx.beginPath();
        }

        // Mouse Events
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
        canvas.addEventListener("mouseleave", stopDrawing);

        // Touch Events
        canvas.addEventListener("touchstart", startDrawing);
        canvas.addEventListener("touchmove", draw);
        canvas.addEventListener("touchend", stopDrawing);

        $("#btn-clear-signature").click(function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
    }

    // EVENT LISTENERS
    function setupEventListeners() {
        // Toggle Sidebar
        $("#btn-toggle-sidebar").click(function() {
            $(".sidebar").toggleClass("show");
        });

        // Navigation
        $(".sidebar .nav-link").click(function(e) {
            e.preventDefault();
            let view = $(this).data("view");
            if (view) {
                showView(view);
                $(".sidebar").removeClass("show");
            }
        });

        // Email fields: prevent whitespace in real-time
        $(document).on("input", "input[type='email'], #user-form-email, #login-email", function() {
            this.value = this.value.replace(/\s/g, '');
        });

        // Login Form
        $("#form-login").submit(function(e) {
            e.preventDefault();
            let email = $("#login-email").val();
            let password = $("#login-pass").val();

            $.ajax({
                url: "/api/login",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ email: email, password: password }),
                success: function(user) {
                    $("#login-error-alert").addClass("d-none");
                    loginUser(user);
                },
                error: function(xhr) {
                    let errMsg = xhr.responseJSON?.error || "Error al conectar con el servidor.";
                    $("#login-error-alert").text(errMsg).removeClass("d-none");
                }
            });
        });

        // Recover Pass (Simulated)
        $("#btn-recover-pass").click(function(e) {
            e.preventDefault();
            let modal = new bootstrap.Modal(document.getElementById("recoverPasswordModal"));
            modal.show();
        });

        $("#btn-send-recover").click(function() {
            let email = $("#recover-email").val();
            if (!email) {
                alert("Por favor ingrese su correo.");
                return;
            }
            alert("Se ha enviado un enlace de recuperación al correo: " + email);
            bootstrap.Modal.getInstance(document.getElementById("recoverPasswordModal")).hide();
        });

        // Logout
        $("#btn-logout").click(function() {
            $.ajax({
                url: "/api/logout",
                method: "POST",
                success: function() {
                    currentUser = null;
                    activePatient = null;
                    $("#patient-context-bar").addClass("d-none");
                    showView("login");
                }
            });
        });

        // Global Patient Search
        $("#global-patient-search").on("input", function() {
            let val = $(this).val();
            if (val.length < 2) {
                $("#patient-search-results").hide();
                return;
            }

            $.ajax({
                url: "/api/pacientes?search=" + encodeURIComponent(val),
                method: "GET",
                success: function(list) {
                    let dropdown = $("#patient-search-results");
                    dropdown.empty();
                    
                    if (list.length === 0) {
                        dropdown.append(`<li class="dropdown-item text-muted">No se encontraron pacientes</li>`);
                    } else {
                        list.forEach(p => {
                            let photo = p.Foto || MOCK_IMAGES.avatar;
                            let color = p.TipificacionColor || "#28a745";
                            dropdown.append(`
                                <li class="dropdown-item d-flex align-items-center gap-2 cursor-pointer border-bottom border-light" data-id="${p.id_Usuario}">
                                    <img src="${photo}" class="rounded-circle" style="width: 32px; height: 32px; object-fit: cover;">
                                    <div class="flex-grow-1">
                                        <div class="fw-bold small text-dark">${p.Nombre} ${p.ApPat}</div>
                                        <div class="text-muted" style="font-size: 0.75rem;">ID: ${p.id_Usuario} | Tel: ${p.Telefono || 'Sin número'}</div>
                                    </div>
                                    <span class="badge" style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%;" title="${p.TipificacionNivel || 'Verde'}"> </span>
                                </li>
                            `);
                        });
                    }
                    dropdown.show();
                }
            });
        });

        // Select Patient Search Result
        $(document).on("click", "#patient-search-results li", function() {
            let id = $(this).data("id");
            if (!id) return;
            
            $.ajax({
                url: "/api/usuarios?id=" + id,
                method: "GET",
                success: function(p) {
                    selectPatientContext(p);
                    $("#patient-search-results").hide();
                    $("#global-patient-search").val("");
                }
            });
        });

        // Hide search result dropdown on outer click
        $(document).click(function(e) {
            if (!$(e.target).closest('#patient-search-container').length) {
                $("#patient-search-results").hide();
            }
        });

        // Clear Patient Context
        $("#btn-clear-patient-context").click(function() {
            activePatient = null;
            $("#patient-context-bar").addClass("d-none");
            
            // Reload current views to represent empty state
            showView(activeView);
        });

        // Quick Actions from Dashboard
        $("#dash-action-new-patient").click(function() {
            $("#btn-new-user-form").click();
        });

        $("#dash-action-new-appt").click(function() {
            $("#btn-new-appointment").click();
        });

        $("#dash-action-new-config").click(function() {
            showView("catalogos");
        });

        // BEFORE AFTER RANGE SLIDER LOGIC
        $("#before-after-bar-range").on("input", function() {
            let val = $(this).val();
            $("#slider-after-wrapper").css("width", val + "%");
            $("#before-after-divider-btn").css("left", val + "%");
        });

        // Base64 file converter utilities
        $("#user-form-photo-file").change(function() {
            let file = this.files[0];
            if (file) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    $("#user-form-photo-base64").val(e.target.result);
                    $("#user-form-photo-preview").attr("src", e.target.result).show();
                };
                reader.readAsDataURL(file);
            }
        });

        $("#config-logo-file").change(function() {
            let file = this.files[0];
            if (file) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    $("#config-logo-base64").val(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        $("#history-before-img-file").change(function() {
            let file = this.files[0];
            if (file) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    $("#history-before-img-base64").val(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        $("#history-after-img-file").change(function() {
            let file = this.files[0];
            if (file) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    $("#history-after-img-base64").val(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        // Change Password Modal triggers
        $("#btn-open-change-pass").click(function() {
            let modal = new bootstrap.Modal(document.getElementById("changePasswordModal"));
            modal.show();
        });

        $("#form-change-password").submit(function(e) {
            e.preventDefault();
            let current = $("#change-pass-current").val();
            let newP = $("#change-pass-new").val();
            let confirmP = $("#change-pass-confirm").val();

            if (newP !== confirmP) {
                alert("La confirmación de la nueva contraseña no coincide.");
                return;
            }
            if (newP.length < 6) {
                alert("La nueva contraseña debe tener al menos 6 caracteres.");
                return;
            }

            $.ajax({
                url: "/api/usuario/password",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    id_usuario: currentUser.id_Usuario,
                    current_pass: current,
                    new_pass: newP
                }),
                success: function(res) {
                    alert(res.message);
                    $("#form-change-password")[0].reset();
                    bootstrap.Modal.getInstance(document.getElementById("changePasswordModal")).hide();
                },
                error: function(xhr) {
                    alert(xhr.responseJSON?.error || "Error al cambiar contraseña.");
                }
            });
        });
    }

    // SET ACTIVE PATIENT CONTEXT
    function selectPatientContext(patient) {
        activePatient = patient;
        let photo = patient.Foto || MOCK_IMAGES.avatar;
        let color = patient.TipificacionColor || "#28a745";
        
        $("#patient-context-photo").attr("src", photo);
        $("#patient-context-name").text(`${patient.Nombre} ${patient.ApPat} ${patient.ApMat || ''}`);
        
        let label = patient.id_Tipificacion ? "Asignada" : "Sin asignar (Verde)";
        $("#patient-context-typification").text(label).css("background-color", color);
        $("#patient-context-bar").removeClass("d-none");

        // Dynamically reload current view to show selected patient info
        showView(activeView);
    }

    // ==========================================
    // MODULE 2: REGISTRO DE USUARIOS (CRUD)
    // ==========================================
    function loadUsersList() {
        $.ajax({
            url: "/api/usuarios",
            method: "GET",
            dataType: "json",
            success: function(list) {
                let tbody = $("#users-list-tbody");
                tbody.empty();

                if (list.length === 0) {
                    tbody.append(`<tr><td colspan="7" class="text-center py-3">No hay usuarios registrados</td></tr>`);
                    return;
                }

                list.forEach(u => {
                    let badgeClass = u.id_Roll == 5 ? "bg-info text-dark" : "bg-primary";
                    tbody.append(`
                        <tr>
                            <td>${u.id_Usuario}</td>
                            <td><span class="fw-bold">${u.Nombre} ${u.ApPat}</span></td>
                            <td>${u.Email}</td>
                            <td>${u.Telefono || 'Sin número'}</td>
                            <td><span class="badge ${badgeClass}">${u.Roll}</span></td>
                            <td><span class="badge bg-success">Activo</span></td>
                            <td>
                                <button class="btn btn-xs btn-outline-primary btn-edit-user me-1" data-id="${u.id_Usuario}"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-xs btn-outline-danger btn-delete-user" data-id="${u.id_Usuario}"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `);
                });
            }
        });
    }

    // Toggle Role-based views in User Form
    $("#user-form-role").change(function() {
        let val = $(this).val();
        if (val === "5") {
            // Patient
            $("#patient-only-fields").removeClass("d-none");
            $("#user-form-motive").attr("required", true);
        } else {
            $("#patient-only-fields").addClass("d-none");
            $("#user-form-motive").removeAttr("required");
        }
    });

    $("#btn-new-user-form").click(function() {
        $("#form-user")[0].reset();
        $("#user-form-id").val("0");
        $("#userModalTitle").text("Registrar Nuevo Usuario");
        $("#user-form-pass-group").show();
        $("#user-form-pass").attr("required", true);
        $("#patient-only-fields").addClass("d-none");
        $("#user-form-photo-preview").attr("src", "").hide();
        $("#user-form-photo-base64").val("");
        $("#userFormModal").modal("show");
    });

    // Save user form (POST/PUT)
    $("#form-user").submit(function(e) {
        e.preventDefault();
        let id = parseInt($("#user-form-id").val());
        let isNew = id === 0;

        let payload = {
            id_Usuario: id,
            id_Roll: $("#user-form-role").val(),
            email: $("#user-form-email").val(),
            pass: $("#user-form-pass").val(),
            nombre: $("#user-form-name").val(),
            apPat: $("#user-form-ap-pat").val(),
            apMat: $("#user-form-ap-mat").val(),
            sexo: $("#user-form-sex").val(),
            telefono: $("#user-form-phone").val(),
            ocupacion: $("#user-form-occupation").val(),
            fechaNat: $("#user-form-birth").val(),
            domicilio: $("#user-form-address").val(),
            telefonoEmergencia: $("#user-form-emerg").val(),
            motivoConsulta: $("#user-form-motive").val(),
            observaciones: $("#user-form-remarks").val(),
            foto: $("#user-form-photo-base64").val(),
            id_Tipificacion: $("#user-form-typification").val() || null
        };

        $.ajax({
            url: "/api/usuarios",
            method: isNew ? "POST" : "PUT",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function(res) {
                $("#userFormModal").modal("hide");
                loadUsersList();
                loadDashboardStats();
                alert(isNew ? "Usuario registrado con éxito." : "Usuario actualizado con éxito.");

                if (!isNew && currentUser && id === currentUser.id_Usuario) {
                    checkSession();
                }

                if (isNew && parseInt(payload.id_Roll) === 5) {
                    let colors = {
                        1: "#28a745",
                        2: "#ffc107",
                        3: "#fd7e14",
                        4: "#dc3545"
                    };
                    let newPatient = {
                        id_Usuario: res.id_Usuario,
                        Nombre: payload.nombre,
                        ApPat: payload.apPat,
                        ApMat: payload.apMat,
                        Foto: payload.foto,
                        id_Tipificacion: payload.id_Tipificacion,
                        TipificacionColor: colors[payload.id_Tipificacion] || "#28a745"
                    };
                    selectPatientContext(newPatient);
                    showView("patologias");
                }
            },
            error: function(xhr) {
                alert(xhr.responseJSON?.error || "Error al guardar el usuario.");
            }
        });
    });

    // Edit user click
    $(document).on("click", ".btn-edit-user", function() {
        let id = $(this).data("id");
        $.ajax({
            url: "/api/usuarios?id=" + id,
            method: "GET",
            success: function(u) {
                $("#form-user")[0].reset();
                $("#user-form-id").val(u.id_Usuario);
                $("#userModalTitle").text("Modificar Usuario ID #" + u.id_Usuario);
                
                $("#user-form-name").val(u.Nombre);
                $("#user-form-ap-pat").val(u.ApPat);
                $("#user-form-ap-mat").val(u.ApMat);
                $("#user-form-email").val(u.Email);
                
                // Hide required password for edits
                $("#user-form-pass-group").hide();
                $("#user-form-pass").removeAttr("required");

                $("#user-form-role").val(u.id_Roll).trigger("change");
                $("#user-form-sex").val(u.Sexo);
                
                if (u.FechaNat) {
                    let formattedDate = new Date(u.FechaNat).toISOString().substring(0, 10);
                    $("#user-form-birth").val(formattedDate);
                }

                $("#user-form-phone").val(u.Telefono);
                $("#user-form-occupation").val(u.Ocupacion);
                $("#user-form-address").val(u.Domicilio);
                $("#user-form-emerg").val(u.TelefonoEmergencia);
                $("#user-form-motive").val(u.MotivoConsulta);
                $("#user-form-remarks").val(u.Observaciones);
                $("#user-form-photo-base64").val(u.Foto);
                if (u.Foto) {
                    $("#user-form-photo-preview").attr("src", u.Foto).show();
                } else {
                    $("#user-form-photo-preview").attr("src", "").hide();
                }
                $("#user-form-typification").val(u.id_Tipificacion);

                $("#userFormModal").modal("show");
            }
        });
    });

    // Delete user (Baja)
    $(document).on("click", ".btn-delete-user", function() {
        let id = $(this).data("id");
        if (confirm("¿Está seguro que desea dar de BAJA al usuario ID #" + id + "?")) {
            $.ajax({
                url: "/api/usuarios?id=" + id,
                method: "DELETE",
                success: function(res) {
                    loadUsersList();
                    loadDashboardStats();
                    alert(res.message);
                },
                error: function(xhr) {
                    alert(xhr.responseJSON?.error || "Error al dar de baja al usuario.");
                }
            });
        }
    });

    // ==========================================
    // MODULE 3: PATOLOGIAS
    // ==========================================
    function loadPatologiasView() {
        if (!activePatient) {
            $("#patologias-no-patient-alert").removeClass("d-none");
            $("#patologias-content").addClass("d-none");
            return;
        }

        $("#patologias-no-patient-alert").addClass("d-none");
        $("#patologias-content").removeClass("d-none");

        // Load Patient and relative pathology mappings
        $.ajax({
            url: "/api/patologias?id_usuario=" + activePatient.id_Usuario,
            method: "GET",
            success: function(data) {
                // Clear state
                patientPathologies.personales = [];
                patientPathologies.familiares = {};

                // Map Personal Pathologies
                if (data.personales) {
                    data.personales.forEach(p => {
                        patientPathologies.personales.push(p.Id_Patologia);
                    });
                }
                updateRelativeBadgeCount("Paciente", patientPathologies.personales.length);

                // Map Family Pathologies
                let f = data.familiares;
                let relatives = ["Madre", "Padre", "AbuelaMat", "AbueloMat", "AbuelaPat", "AbueloPat"];
                
                relatives.forEach(rel => {
                    let patString = f ? f[rel] : "";
                    let patList = patString ? patString.split(",").map(s => s.trim()) : [];
                    patientPathologies.familiares[rel] = patList;
                    updateRelativeBadgeCount(rel, patList.length);
                });

                // Load Tipificacion & Remarks
                $("#patologia-tipificacion").val(activePatient.id_Tipificacion || "");
                $("#patologia-observaciones").val(activePatient.Observaciones || "");
            }
        });
    }

    function updateRelativeBadgeCount(relative, count) {
        $(`#badge-count-${relative}`).text(count + " Marcadas");
    }

    // Relative card click - opens selector modal
    $(".relative-card").click(function() {
        selectedRelative = $(this).data("relative");
        $(".relative-card").removeClass("active");
        $(this).addClass("active");

        $("#modal-relative-title").text($(this).find(".fw-bold").text());

        // Get currently selected pathologies for this relative
        let currentSelections = [];
        if (selectedRelative === "Paciente") {
            currentSelections = patientPathologies.personales;
        } else {
            currentSelections = patientPathologies.familiares[selectedRelative] || [];
        }

        // Build checklist: Diabetes, HTA, Cardiopatías, Neoplasias, Epilepsia, Malformaciones, SIDA, ER, Hepatitis, Artritis, Otras
        let checklistDiv = $("#pathologies-checklist");
        checklistDiv.empty();

        let pathologiesCatalog = [
            "Diabetes", "HTA", "Cardiopatías", "Neoplasias", "Epilepsia", 
            "Malformaciones", "SIDA", "ER (Enfermedad Renal)", "Hepatitis", "Artritis", "Otras"
        ];

        pathologiesCatalog.forEach(p => {
            let isChecked = currentSelections.includes(p) ? "checked" : "";
            checklistDiv.append(`
                <div class="col">
                    <div class="form-check">
                        <input class="form-check-input pathology-chk" type="checkbox" value="${p}" id="chk-pat-${p.replace(/\s+/g, '')}" ${isChecked}>
                        <label class="form-check-label fw-medium" for="chk-pat-${p.replace(/\s+/g, '')}">${p}</label>
                    </div>
                </div>
            `);
        });

        $("#pathologySelectionModal").modal("show");
    });

    // Confirmation of pathology selection on modal hide
    $("#pathologySelectionModal").on("hide.bs.modal", function() {
        let chks = $(".pathology-chk:checked");
        let list = [];
        chks.each(function() {
            list.push($(this).val());
        });

        if (selectedRelative === "Paciente") {
            patientPathologies.personales = list;
        } else {
            patientPathologies.familiares[selectedRelative] = list;
        }

        updateRelativeBadgeCount(selectedRelative, list.length);
    });

    // Save Pathologies expedients
    $("#btn-save-patologias").click(function() {
        if (!activePatient) return;

        let payload = {
            id_usuario: activePatient.id_Usuario,
            personales: JSON.stringify(patientPathologies.personales),
            familiares: JSON.stringify(patientPathologies.familiares)
        };

        $.ajax({
            url: "/api/patologias",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                // Update typification & observations
                let tipId = $("#patologia-tipificacion").val();
                let remarks = $("#patologia-observaciones").val();

                $.ajax({
                    url: "/api/usuarios",
                    method: "PUT",
                    contentType: "application/json",
                    data: JSON.stringify({
                        id_Usuario: activePatient.id_Usuario,
                        id_Roll: activePatient.id_Roll,
                        nombre: activePatient.Nombre,
                        apPat: activePatient.ApPat,
                        apMat: activePatient.ApMat,
                        id_Tipificacion: tipId || null,
                        observaciones: remarks
                    }),
                    success: function() {
                        // Refresh patient context
                        $.ajax({
                            url: "/api/usuarios?id=" + activePatient.id_Usuario,
                            method: "GET",
                            success: function(p) {
                                selectPatientContext(p);
                                alert("Expediente patológico actualizado.");
                            }
                        });
                    }
                });
            }
        });
    });


    // ==========================================
    // MODULE 4: ODONTOGRAMA & NOTAS MEDICAS
    // ==========================================
    function loadOdontogramaView() {
        if (!activePatient) {
            $("#odontograma-no-patient-alert").removeClass("d-none");
            $("#odontograma-content").addClass("d-none");
            return;
        }

        $("#odontograma-no-patient-alert").addClass("d-none");
        $("#odontograma-content").removeClass("d-none");

        // Clear notes form and tooth select panel
        $("#form-medical-note")[0].reset();
        $("#history-before-img-base64").val("");
        $("#history-after-img-base64").val("");
        $("#tooth-assign-panel").addClass("d-none");

        let format = $("input[name='odont-format']:checked").val();
        loadOdontogramaTeeth(format);
        loadClinicalHistory();
    }

    $("input[name='odont-format']").change(function() {
        let format = $(this).val();
        loadOdontogramaTeeth(format);
    });

    function loadOdontogramaTeeth(format) {
        if (!activePatient) return;

        // Fetch teeth states for patient
        $.ajax({
            url: `/api/odontograma?id_usuario=${activePatient.id_Usuario}&formato=${format}`,
            method: "GET",
            dataType: "json",
            success: function(teeth) {
                let supRow = $("#odontograma-superior-row");
                let infRow = $("#odontograma-inferior-row");
                supRow.empty();
                infRow.empty();

                teeth.forEach(t => {
                    let isMolar = t.Acronimo === "Muela" || t.id_MapaOdontograma === 18; // Default 18 molar
                    let svg = ODONTOGRAMA_ASSETS.renderToothSVG(t.id_Diente, t.id_MapaOdontograma, t.Acronimo, isMolar);
                    
                    let box = $(`
                        <div class="tooth-box" data-id="${t.id_Diente}" data-map-id="${t.id_MapaOdontograma}" data-is-molar="${isMolar ? 1 : 0}">
                            ${svg}
                            <div class="small fw-semibold text-muted" style="font-size: 0.65rem;">${t.Acronimo}</div>
                        </div>
                    `);

                    if (t.nivel === "Superior") {
                        supRow.append(box);
                    } else {
                        infRow.append(box);
                    }
                });
            }
        });
    }

    // Tooth box click
    $(document).on("click", ".tooth-box", function() {
        // Patient role: Informative only, no modifications allowed
        if (currentUser && parseInt(currentUser.id_Roll) === 5) {
            return;
        }

        $(".tooth-box").removeClass("selected");
        $(this).addClass("selected");

        selectedTooth = {
            id: $(this).data("id"),
            mapId: $(this).data("map-id"),
            isMolar: $(this).data("is-molar")
        };

        $("#assign-tooth-number").text("#" + selectedTooth.id);
        $("#assign-treatment-select").val(selectedTooth.mapId);
        $("#tooth-assign-panel").removeClass("d-none");
    });

    // Save tooth treatment
    $("#btn-save-tooth-treatment").click(function() {
        if (!activePatient || !selectedTooth) return;

        let mapId = $("#assign-treatment-select").val();

        $.ajax({
            url: "/api/odontograma",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                id_usuario: activePatient.id_Usuario,
                id_diente: selectedTooth.id,
                id_mapa: mapId
            }),
            success: function() {
                // Reload active teeth row
                let format = $("input[name='odont-format']:checked").val();
                loadOdontogramaTeeth(format);
                $("#tooth-assign-panel").addClass("d-none");
                alert("Diente actualizado correctamente.");
            }
        });
    });

    // Load medical notes timeline
    function loadClinicalHistory() {
        $.ajax({
            url: "/api/historial?id_usuario=" + activePatient.id_Usuario,
            method: "GET",
            dataType: "json",
            success: function(notes) {
                let container = $("#clinical-notes-timeline");
                container.empty();

                if (notes.length === 0) {
                    container.append(`<div class="text-center text-muted py-3">No hay notas médicas registradas.</div>`);
                    return;
                }

                notes.forEach(n => {
                    let dateStr = new Date(n.Fecha).toLocaleString();
                    let beforeBtn = n.AntesImg ? `<button class="btn btn-xs btn-outline-success btn-view-compare me-1" data-before="${n.AntesImg}" data-after="${n.DespuesImg}"><i class="fa-solid fa-images me-1"></i>Comparar Antes/Después</button>` : "";
                    
                    container.append(`
                        <div class="card border-0 bg-light p-3 rounded-3 shadow-xs">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="fw-bold text-dark"><i class="fa-solid fa-calendar-day me-2 text-primary"></i>${dateStr}</span>
                                <span class="badge bg-secondary">Nota #${n.id_Nota}</span>
                            </div>
                            <p class="mb-2 text-dark" style="white-space: pre-line;">${n.Nota}</p>
                            <div class="border-top pt-2 mt-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <small class="text-muted"><i class="fa-solid fa-signature me-1"></i>Aceptación: <span class="fst-italic">"${n.Consentimiento}"</span></small>
                                <div>
                                    ${beforeBtn}
                                </div>
                            </div>
                        </div>
                    `);
                });
            }
        });
    }

    // View Before/After comparison in slider
    $(document).on("click", ".btn-view-compare", function() {
        let before = $(this).data("before");
        let after = $(this).data("after");

        if (!before || !after) return;

        $("#slider-before-img").attr("src", before);
        $("#slider-after-img").attr("src", after);
        
        $("#slider-no-images-placeholder").addClass("d-none");
        $("#tooth-before-after-slider").removeClass("d-none");

        // Reset slider positions
        $("#before-after-bar-range").val(50);
        $("#slider-after-wrapper").css("width", "50%");
        $("#before-after-divider-btn").css("left", "50%");

        // Scroll to comparison card
        $('html, body').animate({
            scrollTop: $("#before-after-view-panel").offset().top - 100
        }, 300);
    });

    // Save medical note form (POST)
    $("#form-medical-note").submit(function(e) {
        e.preventDefault();
        if (!activePatient) return;

        let payload = {
            id_usuario: activePatient.id_Usuario,
            nota: $("#history-treatment-notes").val(),
            consentimiento: $("#history-consent").val(),
            antesImg: $("#history-before-img-base64").val(),
            despuesImg: $("#history-after-img-base64").val()
        };

        $.ajax({
            url: "/api/historial",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                $("#form-medical-note")[0].reset();
                $("#history-before-img-base64").val("");
                $("#history-after-img-base64").val("");
                loadClinicalHistory();
                alert("Nota clínica registrada con éxito.");
            }
        });
    });


    // ==========================================
    // MODULE 5: BUDGETS & PAYMENTS
    // ==========================================
    function loadPresupuestosView() {
        if (!activePatient) {
            $("#presupuestos-no-patient-alert").removeClass("d-none");
            $("#presupuestos-content").addClass("d-none");
            return;
        }

        $("#presupuestos-no-patient-alert").addClass("d-none");
        $("#presupuestos-content").removeClass("d-none");

        // Reset canvas & payments form
        $("#form-register-payment")[0].reset();
        
        // Trigger window resize event to let signature canvas calculate its width correctly now that it is visible
        setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
            if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 100);

        loadTreatmentsBudgets();
        loadPaymentsHistory();
    }

    function loadTreatmentsBudgets() {
        $.ajax({
            url: "/api/tratamientos/paciente?id_usuario=" + activePatient.id_Usuario,
            method: "GET",
            dataType: "json",
            success: function(list) {
                let tbody = $("#treatment-budgets-tbody");
                let paymentSelect = $("#payment-form-treatment");
                
                tbody.empty();
                paymentSelect.empty();
                paymentSelect.append(`<option value="">Seleccione el tratamiento...</option>`);

                let totalTreatmentsCost = 0;
                
                if (list.length === 0) {
                    tbody.append(`<tr><td colspan="5" class="text-center py-3">No hay tratamientos o presupuestos asignados</td></tr>`);
                } else {
                    list.forEach(item => {
                        let dateStr = new Date(item.FechaIniTrat).toLocaleDateString();
                        let isBudget = item.Presupuesto;
                        
                        let badgeType = isBudget ? '<span class="badge bg-warning text-dark">Presupuesto</span>' : '<span class="badge bg-success">Activo / Tratamiento</span>';
                        let actionBtn = "";

                        // If it is budget, doctor can approve it
                        if (isBudget) {
                            if (currentUser && parseInt(currentUser.id_Roll) !== 5) {
                                actionBtn = `<button class="btn btn-xs btn-outline-success btn-approve-budget" data-id="${item.id_TratPaciente}"><i class="fa-solid fa-check me-1"></i>Aprobar</button>`;
                            }
                        } else {
                            totalTreatmentsCost += parseFloat(item.Monto);
                            // Add active treatment to payment selector dropdown
                            paymentSelect.append(`<option value="${item.id_TratPaciente}" data-monto="${item.Monto}">${item.Tratamiento} ($${item.Monto})</option>`);
                        }

                        tbody.append(`
                            <tr>
                                <td>${dateStr}</td>
                                <td><span class="fw-bold">${item.Tratamiento}</span></td>
                                <td>$${parseFloat(item.Monto).toFixed(2)}</td>
                                <td>${badgeType}</td>
                                <td>${actionBtn || '-'}</td>
                            </tr>
                        `);
                    });
                }

                // Balance calculations
                $("#payment-stat-total-treatments").text("$" + totalTreatmentsCost.toFixed(2));
                calculateTotalDebt(totalTreatmentsCost);
            }
        });
    }

    function calculateTotalDebt(totalCost) {
        $.ajax({
            url: "/api/pagos?id_usuario=" + activePatient.id_Usuario,
            method: "GET",
            dataType: "json",
            success: function(payments) {
                let paid = 0;
                payments.forEach(p => {
                    paid += parseFloat(p.Monto);
                });

                let debt = totalCost - paid;
                if (debt < 0) debt = 0;

                $("#payment-stat-total-paid").text("$" + paid.toFixed(2));
                $("#payment-stat-total-debt").text("$" + debt.toFixed(2));
            }
        });
    }

    // Approve Budget click (converts to active treatment)
    $(document).on("click", ".btn-approve-budget", function() {
        let id = $(this).data("id");
        $.ajax({
            url: "/api/tratamientos/paciente/aprobar",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ id_TratPaciente: id }),
            success: function() {
                loadTreatmentsBudgets();
                alert("Presupuesto aprobado y convertido a tratamiento activo.");
            }
        });
    });

    // Populate budget price on catalog select change
    $("#treatment-select-catalog").change(function() {
        let opt = $(this).find("option:selected");
        let price = opt.data("price");
        $("#treatment-budget-price").val(price ? parseFloat(price).toFixed(2) : "");
    });

    // Add budget trigger
    $("#btn-add-treatment-modal").click(function() {
        $("#form-add-treatment")[0].reset();
        $("#addTreatmentModal").modal("show");
    });

    $("#form-add-treatment").submit(function(e) {
        e.preventDefault();
        if (!activePatient) return;

        let payload = {
            id_usuario: activePatient.id_Usuario,
            id_tratamiento: $("#treatment-select-catalog").val(),
            presupuesto: $("#treatment-budget-is-presupuesto").is(":checked")
        };

        $.ajax({
            url: "/api/tratamientos/paciente",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                $("#addTreatmentModal").modal("hide");
                loadTreatmentsBudgets();
                alert("Asignación de tratamiento registrada.");
            }
        });
    });

    // Submit payment with canvas signature
    $("#form-register-payment").submit(function(e) {
        e.preventDefault();
        if (!activePatient) return;

        // Verify if canvas is empty
        let blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        if (canvas.toDataURL() === blankCanvas.toDataURL()) {
            alert("Por favor, el paciente debe firmar de aceptación para registrar el pago.");
            return;
        }

        let signatureDataUrl = canvas.toDataURL(); // Base64 png signature

        let payload = {
            id_usuario: activePatient.id_Usuario,
            id_TratamientoPaciente: $("#payment-form-treatment").val(),
            monto: $("#payment-form-amount").val(),
            firma: signatureDataUrl
        };

        $.ajax({
            url: "/api/pagos",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                // Clear and refresh
                $("#form-register-payment")[0].reset();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                loadPresupuestosView();
                loadDashboardStats();
                alert("Pago registrado correctamente.");
            }
        });
    });

    function loadPaymentsHistory() {
        $.ajax({
            url: "/api/pagos?id_usuario=" + activePatient.id_Usuario,
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#payments-history-list");
                container.empty();

                if (list.length === 0) {
                    container.append(`<div class="text-center text-muted py-3">No hay pagos registrados.</div>`);
                    return;
                }

                list.forEach(p => {
                    let dateStr = new Date(p.Fecha).toLocaleString();
                    let signatureImg = p.FirmaUrl ? `<img src="${p.FirmaUrl}" style="height: 40px; border: 1px solid #e2e8f0; background: #fff;" class="rounded">` : '<span class="text-muted small">Sin firma</span>';
                    
                    container.append(`
                        <div class="p-2 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <span class="fw-bold text-success">+$${parseFloat(p.Monto).toFixed(2)}</span>
                                <div class="text-muted" style="font-size: 0.75rem;"><i class="fa-solid fa-clock me-1"></i>${dateStr}</div>
                            </div>
                            <div>
                                ${signatureImg}
                            </div>
                        </div>
                    `);
                });
            }
        });
    }


    // ==========================================
    // MODULE 6: CALENDARIO / AGENDA INTELIGENTE
    // ==========================================
    function loadAgendaView() {
        // Load blocked days, then render calendar
        $.ajax({
            url: "/api/catalogos/dias_no_laborables",
            method: "GET",
            dataType: "json",
            success: function(days) {
                nonWorkingDays = days.map(d => new Date(d.Fecha).toISOString().split('T')[0]);
                renderCalendar();
            }
        });
    }

    function renderCalendar() {
        let grid = $("#calendar-grid-container");
        grid.empty();

        // Month Names
        let months = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        $("#calendar-month-year").text(months[currentMonth] + " " + currentYear);

        // Header days
        let weekDays = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
        weekDays.forEach(d => {
            grid.append(`<div class="calendar-header-day">${d}</div>`);
        });

        let firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        let prevDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        // Fetch all appointments for the month range to draw badges
        let startDate = new Date(currentYear, currentMonth, -7).toISOString().substring(0, 10);
        let endDate = new Date(currentYear, currentMonth + 1, 7).toISOString().substring(0, 10);
        
        $.ajax({
            url: `/api/citas?inicio=${startDate}&fin=${endDate}`,
            method: "GET",
            dataType: "json",
            success: function(appointments) {
                
                // Draw cells of calendar
                // 1. Previous Month Days
                for (let i = firstDayIndex; i > 0; i--) {
                    let d = prevDaysInMonth - i + 1;
                    let cellDate = new Date(currentYear, currentMonth - 1, d);
                    drawCalendarCell(grid, cellDate, false, appointments);
                }

                // 2. Current Month Days
                for (let i = 1; i <= daysInMonth; i++) {
                    let cellDate = new Date(currentYear, currentMonth, i);
                    drawCalendarCell(grid, cellDate, true, appointments);
                }

                // 3. Next Month Days
                let totalCells = firstDayIndex + daysInMonth;
                let nextMonthDays = 42 - totalCells; // Standard 6 lines grid
                for (let i = 1; i <= nextMonthDays; i++) {
                    let cellDate = new Date(currentYear, currentMonth + 1, i);
                    drawCalendarCell(grid, cellDate, false, appointments);
                }
            }
        });
    }

    function drawCalendarCell(container, date, isCurrentMonth, appointments) {
        let dateISO = date.toISOString().split('T')[0];
        let isToday = new Date().toISOString().split('T')[0] === dateISO;
        let isSunday = date.getDay() === 0;
        let isNonWorking = isSunday || nonWorkingDays.includes(dateISO);

        let cellClass = "calendar-cell";
        if (!isCurrentMonth) cellClass += " other-month";
        if (isToday) cellClass += " today";
        if (isNonWorking) cellClass += " non-working";

        // Filter appointments for this specific day
        let apptsToday = appointments.filter(a => new Date(a.Fecha).toISOString().split('T')[0] === dateISO);

        let badgeHtml = "";
        apptsToday.forEach(a => {
            badgeHtml += `<span class="calendar-badge badge-${a.Estado}" title="${a.PacienteNombre} - ${a.Hora}">${a.Hora} ${a.PacienteNombre}</span>`;
        });

        let cell = $(`
            <div class="${cellClass}" data-date="${dateISO}" data-non-working="${isNonWorking ? 1 : 0}">
                <div class="fw-bold small text-end">${date.getDate()}</div>
                <div class="flex-grow-1 mt-1">${badgeHtml}</div>
                ${isNonWorking ? '<span class="text-center font-monospace" style="font-size:0.6rem;">CERRADO</span>' : ''}
            </div>
        `);

        container.append(cell);
    }

    // Prev & Next Month buttons
    $("#btn-calendar-prev").click(function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    $("#btn-calendar-next").click(function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    // Calendar Cell Click -> Load appointments for selected day
    $(document).on("click", ".calendar-cell", function() {
        let date = $(this).data("date");
        let isNonWorking = $(this).data("non-working") == 1;
        
        $("#selected-calendar-date-label").text("Día: " + date);
        loadSelectedDayAppointments(date);

        // Prepopulate appointment form date
        $("#appt-form-date").val(date);

        if (isNonWorking) {
            $("#btn-new-appointment").addClass("d-none"); // Block booking
        } else {
            $("#btn-new-appointment").removeClass("d-none");
        }
    });

    function loadSelectedDayAppointments(date) {
        $.ajax({
            url: "/api/citas?fecha=" + date,
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#selected-day-appointments-list");
                container.empty();

                if (list.length === 0) {
                    container.append(`<div class="text-center text-muted py-4">No hay citas registradas para este día.</div>`);
                    return;
                }

                list.forEach(a => {
                    let photo = a.PacienteFoto || MOCK_IMAGES.avatar;
                    let color = a.TipificacionColor || "#28a745";
                    let stateBadge = `<span class="badge badge-${a.Estado}">${a.Estado.toUpperCase()}</span>`;
                    
                    let statusButtons = "";
                    // Doctor/Assistant can change status (attended, waiting, cancelled)
                    if (currentUser && parseInt(currentUser.id_Roll) !== 5) {
                        statusButtons = `
                            <div class="btn-group btn-group-xs mt-2">
                                <button class="btn btn-outline-success btn-appt-status" data-id="${a.id_Cita}" data-status="atendido"><i class="fa-solid fa-circle-check"></i> Atendido</button>
                                <button class="btn btn-outline-warning btn-appt-status text-dark" data-id="${a.id_Cita}" data-status="espera"><i class="fa-solid fa-clock"></i> Espera</button>
                                <button class="btn btn-outline-danger btn-appt-status" data-id="${a.id_Cita}" data-status="cancelado"><i class="fa-solid fa-circle-xmark"></i> Cancelar</button>
                            </div>
                        `;
                    }

                    container.append(`
                        <div class="card p-3 border-0 bg-light rounded-3 shadow-xs">
                            <div class="d-flex align-items-center gap-3">
                                <img src="${photo}" class="rounded-circle" style="width: 40px; height: 40px; object-fit: cover;">
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold text-dark text-truncate">${a.PacienteNombre}</div>
                                    <div class="small text-muted">${a.Hora} - ${a.Motivo || 'Consulta'}</div>
                                </div>
                                <div>
                                    ${stateBadge}
                                </div>
                            </div>
                            ${statusButtons}
                        </div>
                    `);
                });
            }
        });
    }

    // Change appointment status (PUT)
    $(document).on("click", ".btn-appt-status", function() {
        let id = $(this).data("id");
        let status = $(this).data("status");

        $.ajax({
            url: "/api/citas/estado",
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify({ id_cita: id, estado: status }),
            success: function() {
                // Refresh
                renderCalendar();
                let selectedDate = $("#appt-form-date").val();
                if (selectedDate) loadSelectedDayAppointments(selectedDate);
                loadDashboardStats();
            }
        });
    });

    // New Appointment Modal trigger
    $("#btn-new-appointment").click(function() {
        // If patient log-in, auto-select patient select field and hide it
        if (currentUser && parseInt(currentUser.id_Roll) === 5) {
            $("#appt-form-patient-select-group").addClass("d-none");
            $("#appt-form-patient").val(currentUser.id_Usuario).attr("required", false);
        } else {
            $("#appt-form-patient-select-group").removeClass("d-none");
            $("#appt-form-patient").attr("required", true);
            // If active patient is loaded, pre-select it
            if (activePatient) {
                $("#appt-form-patient").val(activePatient.id_Usuario);
            }
        }

        $("#appointmentFormModal").modal("show");
    });

    // Submit appointment form (POST)
    $("#form-appointment").submit(function(e) {
        e.preventDefault();
        
        let pId = currentUser && parseInt(currentUser.id_Roll) === 5 ? currentUser.id_Usuario : $("#appt-form-patient").val();
        let date = $("#appt-form-date").val();
        let hour = $("#appt-form-time").val();
        let motive = $("#appt-form-motive").val();

        $.ajax({
            url: "/api/citas",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                id_user: pId,
                fecha: date,
                hora: hour,
                motivo: motive
            }),
            success: function(res) {
                $("#appointmentFormModal").modal("hide");
                renderCalendar();
                loadSelectedDayAppointments(date);
                loadDashboardStats();
                alert(res.message);
            },
            error: function(xhr) {
                alert(xhr.responseJSON?.error || "Error al programar la cita.");
            }
        });
    });

    // Search historical appointments range
    $("#btn-search-appointments-range").click(function() {
        let start = $("#appt-search-start").val();
        let end = $("#appt-search-end").val();

        if (!start || !end) {
            alert("Debe seleccionar fecha de inicio y de fin.");
            return;
        }

        $.ajax({
            url: `/api/citas?inicio=${start}&fin=${end}`,
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#appt-search-results-list");
                container.empty();
                $("#appt-search-results-container").removeClass("d-none");

                if (list.length === 0) {
                    container.append(`<div class="text-center text-muted small py-3">No hay citas en este rango</div>`);
                    return;
                }

                list.forEach(a => {
                    let dStr = new Date(a.Fecha).toLocaleDateString();
                    container.append(`
                        <div class="p-2 border-bottom bg-light rounded shadow-xs" style="font-size:0.8rem;">
                            <div class="d-flex justify-content-between">
                                <span class="fw-bold">${dStr} - ${a.Hora}</span>
                                <span class="badge badge-${a.Estado}">${a.Estado}</span>
                            </div>
                            <div class="text-dark truncate">${a.PacienteNombre}</div>
                        </div>
                    `);
                });
            }
        });
    });


    // ==========================================
    // MODULE 7: REPORTES CLINICOS & FINANZAS
    // ==========================================
    function loadReportesView() {
        $.ajax({
            url: "/api/reportes",
            method: "GET",
            dataType: "json",
            success: function(data) {
                // Balance cards
                let totalIncome = 0;
                let totalExpenses = 0;

                data.ingresosPorDia.forEach(i => totalIncome += parseFloat(i.Total));
                data.egresos.forEach(e => totalExpenses += parseFloat(e.Monto));
                
                let balance = totalIncome - totalExpenses;

                $("#report-financial-income").text("$" + totalIncome.toFixed(2));
                $("#report-financial-expenses").text("$" + totalExpenses.toFixed(2));
                $("#report-financial-balance").text("$" + balance.toFixed(2)).css("color", balance >= 0 ? "green" : "red");

                // Render Charts
                renderReportCharts(data);
            }
        });
    }

    function renderReportCharts(data) {
        // 1. Patient Growth Line Chart
        let patientLabels = data.pacientesCrecimiento.map(p => p.Mes);
        let patientCounts = data.pacientesCrecimiento.map(p => p.Total);

        if (chartPatients) chartPatients.destroy();
        chartPatients = new Chart(document.getElementById("chart-patients-growth"), {
            type: 'line',
            data: {
                labels: patientLabels.length > 0 ? patientLabels : ["Sin datos"],
                datasets: [{
                    label: 'Pacientes Registrados',
                    data: patientCounts.length > 0 ? patientCounts : [0],
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 2. Appointment States Doughnut Chart
        let apptLabels = data.citasResumen.map(c => c.Estado.toUpperCase());
        let apptCounts = data.citasResumen.map(c => c.Total);

        if (chartAppts) chartAppts.destroy();
        chartAppts = new Chart(document.getElementById("chart-appointments-summary"), {
            type: 'doughnut',
            data: {
                labels: apptLabels.length > 0 ? apptLabels : ["SIN CITAS"],
                datasets: [{
                    data: apptCounts.length > 0 ? apptCounts : [1],
                    backgroundColor: ['#198754', '#ffc107', '#dc3545', '#6c757d']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 3. Financial Income vs Expenses Bar Chart
        let financeDays = data.ingresosPorDia.map(i => i.Dia);
        let financeIncome = data.ingresosPorDia.map(i => i.Total);

        if (chartFinances) chartFinances.destroy();
        chartFinances = new Chart(document.getElementById("chart-finances"), {
            type: 'bar',
            data: {
                labels: financeDays.length > 0 ? financeDays : ["Sin datos"],
                datasets: [
                    {
                        label: 'Ingresos ($)',
                        data: financeIncome.length > 0 ? financeIncome : [0],
                        backgroundColor: '#198754'
                    },
                    {
                        label: 'Egresos Estimados ($)',
                        data: financeDays.map(() => 200), // Static representation
                        backgroundColor: '#dc3545'
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }


    // ==========================================
    // MODULE 8: CONFIGURACION Y CATALOGOS
    // ==========================================
    function loadCatalogosView() {
        loadNonWorkingList();
        loadCatalogTreatmentsList();
        loadCatalogTypificationsList();
    }

    // Save Clinical Skin Changes (Clinic name, logo, backgrounds, colors)
    $("#form-config-site").submit(function(e) {
        e.preventDefault();
        
        let payload = {
            NombreSitio: $("#config-site-name").val(),
            ColorPrimario: $("#config-primary-color").val(),
            ColorSecundario: $("#config-secondary-color").val(),
            Fondo: $("#config-bg-color").val(),
            Logo: $("#config-logo-base64").val()
        };

        $.ajax({
            url: "/api/config",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                loadSiteSettings();
                alert("Configuración estética guardada.");
            }
        });
    });

    // 1. Non-working Days
    function loadNonWorkingList() {
        $.ajax({
            url: "/api/catalogos/dias_no_laborables",
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#config-non-working-list");
                container.empty();

                if (list.length === 0) {
                    container.append(`<li class="list-group-item text-muted text-center py-2 small">No hay días bloqueados</li>`);
                    return;
                }

                list.forEach(item => {
                    let dateStr = new Date(item.Fecha).toLocaleDateString();
                    container.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 small">
                            <span><i class="fa-regular fa-calendar-xmark text-danger me-2"></i>${dateStr} - ${item.Descripcion}</span>
                        </li>
                    `);
                });
            }
        });
    }

    $("#form-config-non-working").submit(function(e) {
        e.preventDefault();
        
        let payload = {
            fecha: $("#non-working-date").val(),
            descripcion: $("#non-working-desc").val()
        };

        $.ajax({
            url: "/api/catalogos/dias_no_laborables",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                $("#form-config-non-working")[0].reset();
                loadNonWorkingList();
                alert("Día bloqueado correctamente.");
            }
        });
    });

    // 2. Treatments Catalog
    function loadCatalogTreatmentsList() {
        $.ajax({
            url: "/api/catalogos/tratamientos",
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#config-treatment-list");
                container.empty();

                list.forEach(item => {
                    container.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 small">
                            <span class="fw-semibold">${item.Tratamiento}</span>
                            <div>
                                <span class="badge bg-success me-2">$${parseFloat(item.Monto).toFixed(2)}</span>
                                <button class="btn btn-xs btn-outline-primary btn-edit-catalog-treatment me-1" data-id="${item.id_Tratamiento}" data-name="${item.Tratamiento}" data-price="${item.Monto}"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-xs btn-outline-danger btn-delete-catalog-treatment" data-id="${item.id_Tratamiento}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </li>
                    `);
                });
            }
        });
    }

    $("#form-config-treatment").submit(function(e) {
        e.preventDefault();
        let id = parseInt($("#config-treatment-id").val() || "0");
        let isNew = id === 0;

        let payload = {
            id_Tratamiento: id,
            tratamiento: $("#config-treatment-desc").val(),
            monto: $("#config-treatment-price").val()
        };

        $.ajax({
            url: "/api/catalogos/tratamientos",
            method: isNew ? "POST" : "PUT",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                $("#form-config-treatment")[0].reset();
                $("#config-treatment-id").val("0");
                $("#form-config-treatment button[type='submit']").html('<i class="fa-solid fa-plus me-1"></i>Agregar al Catálogo');
                $("#btn-cancel-edit-treatment-container").remove();
                loadCatalogTreatmentsList();
                loadCatalogs(); // Refresh dynamic selects
                alert(isNew ? "Tratamiento agregado correctamente." : "Tratamiento actualizado correctamente.");
            },
            error: function(xhr) {
                alert(xhr.responseJSON?.error || "Error al guardar el tratamiento.");
            }
        });
    });

    // Edit Treatment Event Handlers
    $(document).on("click", ".btn-edit-catalog-treatment", function() {
        let id = $(this).data("id");
        let name = $(this).data("name");
        let price = $(this).data("price");
        $("#config-treatment-id").val(id);
        $("#config-treatment-desc").val(name);
        $("#config-treatment-price").val(price);
        $("#form-config-treatment button[type='submit']").html('<i class="fa-solid fa-save me-1"></i>Guardar Cambios');
        if ($("#btn-cancel-edit-treatment").length === 0) {
            $("#form-config-treatment .row").append(`
                <div class="col-12 mt-1" id="btn-cancel-edit-treatment-container">
                    <button type="button" class="btn btn-outline-secondary btn-sm w-100" id="btn-cancel-edit-treatment">Cancelar Edición</button>
                </div>
            `);
        }
    });

    $(document).on("click", "#btn-cancel-edit-treatment", function() {
        $("#config-treatment-id").val("0");
        $("#config-treatment-desc").val("");
        $("#config-treatment-price").val("");
        $("#form-config-treatment button[type='submit']").html('<i class="fa-solid fa-plus me-1"></i>Agregar al Catálogo');
        $("#btn-cancel-edit-treatment-container").remove();
    });

    // Delete Treatment Handler
    $(document).on("click", ".btn-delete-catalog-treatment", function() {
        let id = $(this).data("id");
        if (confirm("¿Está seguro que desea eliminar este tratamiento del catálogo?")) {
            $.ajax({
                url: "/api/catalogos/tratamientos?id=" + id,
                method: "DELETE",
                success: function() {
                    loadCatalogTreatmentsList();
                    loadCatalogs();
                    alert("Tratamiento eliminado correctamente.");
                },
                error: function(xhr) {
                    alert(xhr.responseJSON?.error || "Error al eliminar el tratamiento.");
                }
            });
        }
    });

    // 3. Typifications Catalog
    function loadCatalogTypificationsList() {
        $.ajax({
            url: "/api/catalogos/tipificaciones",
            method: "GET",
            dataType: "json",
            success: function(list) {
                let container = $("#config-typification-list");
                container.empty();

                list.forEach(item => {
                    container.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 small">
                            <div>
                                <span class="badge me-2" style="background-color: ${item.Color}; width: 12px; height: 12px; border-radius: 50%;"> </span>
                                <span class="fw-bold">${item.Nivel}</span> - ${item.Descripcion}
                            </div>
                            <div>
                                <button class="btn btn-xs btn-outline-primary btn-edit-catalog-typification me-1" data-id="${item.id_Tipificacion}" data-level="${item.Nivel}" data-desc="${item.Descripcion}" data-color="${item.Color}"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-xs btn-outline-danger btn-delete-catalog-typification" data-id="${item.id_Tipificacion}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </li>
                    `);
                });
            }
        });
    }

    $("#form-config-typification").submit(function(e) {
        e.preventDefault();
        let id = parseInt($("#config-typification-id").val() || "0");
        let isNew = id === 0;

        let payload = {
            id_Tipificacion: id,
            nivel: $("#config-typification-level").val(),
            descripcion: $("#config-typification-desc").val(),
            color: $("#config-typification-color").val()
        };

        $.ajax({
            url: "/api/catalogos/tipificaciones",
            method: isNew ? "POST" : "PUT",
            contentType: "application/json",
            data: JSON.stringify(payload),
            success: function() {
                $("#form-config-typification")[0].reset();
                $("#config-typification-id").val("0");
                $("#form-config-typification button[type='submit']").html('<i class="fa-solid fa-plus me-1"></i>Agregar Categoría');
                $("#btn-cancel-edit-typification-container").remove();
                loadCatalogTypificationsList();
                loadCatalogs(); // Refresh selects
                alert(isNew ? "Nivel de tipificación creado." : "Nivel de tipificación actualizado.");
            },
            error: function(xhr) {
                alert(xhr.responseJSON?.error || "Error al guardar la tipificación.");
            }
        });
    });

    // Edit Typification Event Handlers
    $(document).on("click", ".btn-edit-catalog-typification", function() {
        let id = $(this).data("id");
        let level = $(this).data("level");
        let desc = $(this).data("desc");
        let color = $(this).data("color");
        $("#config-typification-id").val(id);
        $("#config-typification-level").val(level);
        $("#config-typification-desc").val(desc);
        $("#config-typification-color").val(color);
        $("#form-config-typification button[type='submit']").html('<i class="fa-solid fa-save me-1"></i>Guardar Cambios');
        if ($("#btn-cancel-edit-typification").length === 0) {
            $("#form-config-typification .row").append(`
                <div class="col-12 mt-1" id="btn-cancel-edit-typification-container">
                    <button type="button" class="btn btn-outline-secondary btn-sm w-100" id="btn-cancel-edit-typification">Cancelar Edición</button>
                </div>
            `);
        }
    });

    $(document).on("click", "#btn-cancel-edit-typification", function() {
        $("#config-typification-id").val("0");
        $("#config-typification-level").val("");
        $("#config-typification-desc").val("");
        $("#config-typification-color").val("#0d6efd");
        $("#form-config-typification button[type='submit']").html('<i class="fa-solid fa-plus me-1"></i>Agregar Categoría');
        $("#btn-cancel-edit-typification-container").remove();
    });

    // Delete Typification Handler
    $(document).on("click", ".btn-delete-catalog-typification", function() {
        let id = $(this).data("id");
        if (confirm("¿Está seguro que desea eliminar esta categoría de tipificación?")) {
            $.ajax({
                url: "/api/catalogos/tipificaciones?id=" + id,
                method: "DELETE",
                success: function() {
                    loadCatalogTypificationsList();
                    loadCatalogs();
                    alert("Tipificación eliminada correctamente.");
                },
                error: function(xhr) {
                    alert(xhr.responseJSON?.error || "Error al eliminar la tipificación.");
                }
            });
        }
    });

    // DYNAMIC SELECTS LOADER
    function loadCatalogs() {
        // Load Roles
        $.ajax({
            url: "/api/catalogos/roles",
            method: "GET",
            success: function(roles) {
                let select = $("#user-form-role");
                select.empty().append(`<option value="">Seleccione...</option>`);
                roles.forEach(r => {
                    select.append(`<option value="${r.id_Roll}">${r.Roll}</option>`);
                });
            }
        });

        // Load Tipificaciones
        $.ajax({
            url: "/api/catalogos/tipificaciones",
            method: "GET",
            success: function(list) {
                let selectForm = $("#user-form-typification");
                let selectPat = $("#patologia-tipificacion");

                selectForm.empty().append(`<option value="">Seleccione...</option>`);
                selectPat.empty().append(`<option value="">Seleccione...</option>`);

                list.forEach(t => {
                    selectForm.append(`<option value="${t.id_Tipificacion}">${t.Nivel} (${t.Descripcion})</option>`);
                    selectPat.append(`<option value="${t.id_Tipificacion}">${t.Nivel} (${t.Descripcion})</option>`);
                });
            }
        });

        // Load Treatments Catalog into Assignment Modal
        $.ajax({
            url: "/api/catalogos/tratamientos",
            method: "GET",
            success: function(list) {
                let select = $("#treatment-select-catalog");
                select.empty().append(`<option value="">Seleccione...</option>`);
                list.forEach(t => {
                    select.append(`<option value="${t.id_Tratamiento}" data-price="${t.Monto}">${t.Tratamiento} ($${t.Monto})</option>`);
                });
            }
        });

        // Load Tooth Treatments (MapaOdontograma) into Select dropdown
        $.ajax({
            url: "/api/odontograma/mapa",
            method: "GET",
            success: function(list) {
                let select = $("#assign-treatment-select");
                select.empty();
                list.forEach(m => {
                    select.append(`<option value="${m.id_MapaOdontograma}">${m.Descripcion}</option>`);
                });
            }
        });

        // Populate patient dropdown in appt agenda
        $.ajax({
            url: "/api/pacientes",
            method: "GET",
            success: function(list) {
                let select = $("#appt-form-patient");
                select.empty().append(`<option value="">Seleccione el paciente...</option>`);
                list.forEach(p => {
                    select.append(`<option value="${p.id_Usuario}">${p.Nombre} ${p.ApPat} ${p.ApMat || ''}</option>`);
                });
            }
        });
    }

    // ==========================================
    // DASHBOARD STATS LOADER
    // ==========================================
    function loadDashboardStats() {
        // Total registered patients
        $.ajax({
            url: "/api/pacientes",
            method: "GET",
            success: function(list) {
                $("#dash-stat-patients").text(list.length);
            }
        });

        // Pending appointments today
        let todayStr = new Date().toISOString().substring(0, 10);
        $.ajax({
            url: "/api/citas?fecha=" + todayStr,
            method: "GET",
            success: function(list) {
                let pending = list.filter(a => a.Estado === "espera").length;
                $("#dash-stat-appointments").text(pending);

                // Load today list
                let tbody = $("#dashboard-appointments-list");
                tbody.empty();

                if (list.length === 0) {
                    tbody.append(`<tr><td colspan="5" class="text-center text-muted py-4">No hay citas registradas para hoy.</td></tr>`);
                    return;
                }

                list.forEach(a => {
                    let stateBadge = `<span class="badge badge-${a.Estado}">${a.Estado.toUpperCase()}</span>`;
                    let selectBtn = "";
                    if (currentUser && parseInt(currentUser.id_Roll) !== 5) {
                        selectBtn = `<button class="btn btn-xs btn-primary btn-select-dash-patient" data-id="${a.id_User}"><i class="fa-solid fa-user-check me-1"></i>Ver Paciente</button>`;
                    }

                    tbody.append(`
                        <tr>
                            <td><span class="fw-bold">${a.Hora}</span></td>
                            <td>${a.PacienteNombre}</td>
                            <td>${stateBadge}</td>
                            <td>${a.Motivo || 'Consulta'}</td>
                            <td>${selectBtn || '-'}</td>
                        </tr>
                    `);
                });
            }
        });

        // Today select patient click
        $(document).on("click", ".btn-select-dash-patient", function() {
            let id = $(this).data("id");
            $.ajax({
                url: "/api/usuarios?id=" + id,
                method: "GET",
                success: function(p) {
                    selectPatientContext(p);
                    showView("odontograma");
                }
            });
        });

        // Income monthly sum
        $.ajax({
            url: "/api/reportes",
            method: "GET",
            success: function(data) {
                let monthlySum = 0;
                let currentMonthYearStr = new Date().toISOString().substring(0, 7); // YYYY-MM
                
                data.ingresosPorDia.forEach(i => {
                    if (i.Dia.startsWith(currentMonthYearStr)) {
                        monthlySum += parseFloat(i.Total);
                    }
                });

                $("#dash-stat-payments").text("$" + monthlySum.toFixed(2));
            }
        });
    }

    // Loader messages list (temáticos de consultorio dental)
    const dentalLoaderMessages = [
        "Esterilizando instrumental...",
        "Pulido dental en curso...",
        "Preparando tu mejor sonrisa...",
        "Alineando brackets virtuales...",
        "Limpiando caries...",
        "Aplicando flúor digital...",
        "Cargando expediente clínico...",
        "Calculando presupuesto dental..."
    ];
    let loaderMessageInterval = null;

    function startLoaderMessageRotation() {
        let msgIndex = 0;
        $("#dental-loader-message").text(dentalLoaderMessages[msgIndex]);
        loaderMessageInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % dentalLoaderMessages.length;
            $("#dental-loader-message").fadeOut(150, function() {
                $(this).text(dentalLoaderMessages[msgIndex]).fadeIn(150);
            });
        }, 1800);
    }

    function stopLoaderMessageRotation() {
        if (loaderMessageInterval) {
            clearInterval(loaderMessageInterval);
            loaderMessageInterval = null;
        }
    }

    let activeAjaxCalls = 0;

    $(document).ajaxSend(function(event, xhr, options) {
        // Excluir la búsqueda en tiempo real de pacientes para que no interfiera en la escritura
        if (options.url.indexOf('/api/pacientes?search=') === -1) {
            activeAjaxCalls++;
            if (activeAjaxCalls === 1) {
                $("#global-dental-loader").fadeIn(200);
                startLoaderMessageRotation();
            }
        }
    });

    $(document).ajaxComplete(function(event, xhr, options) {
        if (options.url.indexOf('/api/pacientes?search=') === -1) {
            activeAjaxCalls--;
            if (activeAjaxCalls <= 0) {
                activeAjaxCalls = 0;
                $("#global-dental-loader").fadeOut(200, function() {
                    stopLoaderMessageRotation();
                });
            }
        }
    });

    // RUN THE APPLICATION
    init();
});
