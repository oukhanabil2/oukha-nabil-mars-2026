// app.js - VERSION FINALE STABLE
// Inclut : import data.js corrigé, calcul des jours travaillés (travaillés + fériés), export Excel, mot de passe

// --- CONSTANTES ---
const JOURS_FRANCAIS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const SHIFT_LABELS = {
    '1': 'Matin', '2': 'Après-midi', '3': 'Nuit',
    'R': 'Repos', 'C': 'Congé', 'M': 'Maladie',
    'A': 'Autre absence', '-': 'Non défini'
};
const SHIFT_COLORS = {
    '1': '#3498db', '2': '#e74c3c', '3': '#9b59b6',
    'R': '#2ecc71', 'C': '#f39c12', 'M': '#e67e22',
    'A': '#95a5a6', '-': '#7f8c8d'
};

// Variables globales
let agents = [];
let planningData = {};
let holidays = [];
let panicCodes = [];
let radios = [];
let uniforms = [];
let warnings = [];
let leaves = [];

// Mot de passe
let ADMIN_PASSWORD = localStorage.getItem('sga_password') || "Nabil1974";

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    if (agents.length === 0) initializeTestData();
    displayMainMenu();
});

function loadData() {
    try {
        agents = JSON.parse(localStorage.getItem('sga_agents')) || [];
        planningData = JSON.parse(localStorage.getItem('sga_planning')) || {};
        holidays = JSON.parse(localStorage.getItem('sga_holidays')) || [];
        panicCodes = JSON.parse(localStorage.getItem('sga_panic_codes')) || [];
        radios = JSON.parse(localStorage.getItem('sga_radios')) || [];
        uniforms = JSON.parse(localStorage.getItem('sga_uniforms')) || [];
        warnings = JSON.parse(localStorage.getItem('sga_warnings')) || [];
        leaves = JSON.parse(localStorage.getItem('sga_leaves')) || [];
    } catch(e) { console.error(e); }
}

function saveData() {
    localStorage.setItem('sga_agents', JSON.stringify(agents));
    localStorage.setItem('sga_planning', JSON.stringify(planningData));
    localStorage.setItem('sga_holidays', JSON.stringify(holidays));
    localStorage.setItem('sga_panic_codes', JSON.stringify(panicCodes));
    localStorage.setItem('sga_radios', JSON.stringify(radios));
    localStorage.setItem('sga_uniforms', JSON.stringify(uniforms));
    localStorage.setItem('sga_warnings', JSON.stringify(warnings));
    localStorage.setItem('sga_leaves', JSON.stringify(leaves));
}

function initializeTestData() {
    agents = [
        { code: 'A01', nom: 'Dupont', prenom: 'Alice', groupe: 'A', tel: '0612345678', poste: 'Agent sécurité', statut: 'actif', date_entree: '2025-11-01' },
        { code: 'B02', nom: 'Martin', prenom: 'Bob', groupe: 'B', tel: '0623456789', poste: 'Superviseur', statut: 'actif', date_entree: '2025-11-01' },
        { code: 'C03', nom: 'Lefevre', prenom: 'Carole', groupe: 'C', tel: '0634567890', poste: 'Agent sécurité', statut: 'actif', date_entree: '2025-11-01' },
        { code: 'D04', nom: 'Dubois', prenom: 'David', groupe: 'D', tel: '0645678901', poste: 'Chef équipe', statut: 'actif', date_entree: '2025-11-01' },
        { code: 'E01', nom: 'Zahiri', prenom: 'Ahmed', groupe: 'E', tel: '0656789012', poste: 'Agent spécial', statut: 'actif', date_entree: '2025-11-01' },
        { code: 'E02', nom: 'Zarrouk', prenom: 'Benoit', groupe: 'E', tel: '0667890123', poste: 'Agent spécial', statut: 'actif', date_entree: '2025-11-01' }
    ];
    generateYearlyHolidays();
    saveData();
}

// --- INTERFACE ---
function showSnackbar(msg) {
    const snackbar = document.getElementById('snackbar');
    if (snackbar) {
        snackbar.textContent = msg;
        snackbar.style.display = 'block';
        setTimeout(() => { snackbar.style.display = 'none'; }, 3000);
    } else alert(msg);
}

function openPopup(title, body, footer) {
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('popup-content');
    if (!overlay || !content) return;
    content.innerHTML = `
        <div class="popup-header"><h2>${title}</h2><button class="popup-close-btn" onclick="closePopup()">&times;</button></div>
        <div class="popup-body">${body}</div>
        <div class="popup-footer">${footer}</div>
    `;
    overlay.classList.add('visible');
}

function closePopup() {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('visible');
}

function getMonthName(month) {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return months[month - 1] || '';
}

// --- VÉRIFICATION MOT DE PASSE ---
function checkPassword() {
    const pwd = prompt("🔐 Mot de passe requis :");
    return pwd === ADMIN_PASSWORD;
}

// --- JOURS FÉRIÉS (date exacte) ---
function isHolidayDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return holidays.some(h => h.date === dateStr);
}

// --- NUMÉRO DE SEMAINE ISO ---
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// --- SHIFT THÉORIQUE (logique métier) ---
function calculateTheoreticalShift(agentCode, dateStr) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent || agent.statut !== 'actif') return '-';

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const group = agent.groupe;

    if (group === 'E') {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'R';
        const agentsE = agents.filter(a => a.groupe === 'E' && a.statut === 'actif')
                              .sort((a,b) => a.code.localeCompare(b.code));
        const indexAgent = agentsE.findIndex(a => a.code === agentCode);
        if (indexAgent === -1) return 'R';
        const weekNumber = getWeekNumber(date);
        const isOddWeek = weekNumber % 2 !== 0;
        const isEvenWeekday = dayOfWeek % 2 === 0;
        if (indexAgent === 0) {
            return isOddWeek ? (isEvenWeekday ? '1' : '2') : (isEvenWeekday ? '2' : '1');
        }
        if (indexAgent === 1) {
            return isOddWeek ? (isEvenWeekday ? '2' : '1') : (isEvenWeekday ? '1' : '2');
        }
        return ((indexAgent + weekNumber) % 2 === 0) ? '1' : '2';
    }

    // Groupes A, B, C, D
    const [entryYear, entryMonth, entryDay] = agent.date_entree.split('-').map(Number);
    const dateEntree = new Date(entryYear, entryMonth - 1, entryDay);
    const daysSinceStart = Math.floor((date - dateEntree) / (1000 * 60 * 60 * 24));
    const groupOffset = { 'A': 0, 'B': 2, 'C': 4, 'D': 6 }[group] || 0;
    const cycleDay = (daysSinceStart + groupOffset) % 8;
    const cycle = ['1', '1', '2', '2', '3', '3', 'R', 'R'];
    return cycle[cycleDay];
}

function getShiftForAgent(agentCode, dateStr) {
    const monthKey = dateStr.substring(0, 7);
    if (planningData[monthKey]?.[agentCode]?.[dateStr]) {
        return planningData[monthKey][agentCode][dateStr].shift;
    }
    return calculateTheoreticalShift(agentCode, dateStr);
}

// --- CALCUL DES JOURS TRAVAILLÉS (total = travaillés + fériés travaillés) ---
function calculateWorkedDays(agentCode, month, year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workedDays = 0;          // jours avec shift 1,2,3
    let holidayWorkedDays = 0;   // jours fériés où l'agent travaille
    let leaveDays = 0;           // jours de congé (C, M, A)
    let sundayLeaves = 0;        // congés tombant un dimanche (non comptés)
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const shift = getShiftForAgent(agentCode, dateStr);
        const isSunday = date.getDay() === 0;
        const isHoliday = isHolidayDate(date);
        
        if (shift === '1' || shift === '2' || shift === '3') {
            workedDays++;
            if (isHoliday) holidayWorkedDays++;
        } else if (shift === 'C' || shift === 'M' || shift === 'A') {
            leaveDays++;
            if (isSunday) sundayLeaves++;
        }
    }
    const totalDays = workedDays + holidayWorkedDays;
    return { workedDays, totalDays, leaveDays, holidayWorkedDays, sundayLeaves };
}

// --- STATISTIQUES AVANCÉES ---
function obtenirStatsDetailleesAgent(agentCode, mois, annee) {
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return { erreur: "Agent non trouvé" };
    const daysInMonth = new Date(annee, mois, 0).getDate();
    let joursTravailles = 0, joursRepos = 0, joursConges = 0, joursMaladie = 0, joursAutres = 0, joursFeriesTravailles = 0;
    const joursSemaine = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const shiftsParJour = {};
    joursSemaine.forEach(jour => { shiftsParJour[jour] = { '1':0, '2':0, '3':0, 'R':0, 'C':0, 'M':0, 'A':0 }; });
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(annee, mois - 1, d);
        const dateStr = `${annee}-${String(mois).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const shift = getShiftForAgent(agentCode, dateStr);
        const estFerie = isHolidayDate(date);
        if (shift === '1' || shift === '2' || shift === '3') {
            joursTravailles++;
            if (estFerie) joursFeriesTravailles++;
        } else if (shift === 'R') {
            joursRepos++;
        } else if (shift === 'C') {
            joursConges++;
        } else if (shift === 'M') {
            joursMaladie++;
        } else if (shift === 'A') {
            joursAutres++;
        }
        const jourSemaine = joursSemaine[date.getDay() === 0 ? 6 : date.getDay() - 1];
        if (shiftsParJour[jourSemaine] && shiftsParJour[jourSemaine][shift] !== undefined)
            shiftsParJour[jourSemaine][shift]++;
    }
    const totalJours = joursTravailles + joursFeriesTravailles;
    const tauxPresence = totalJours > 0 ? (joursTravailles / totalJours) * 100 : 0;
    const statsBase = calculateWorkedDays(agentCode, mois, annee);
    return {
        agent: agentCode, nom_complet: `${agent.nom} ${agent.prenom}`, groupe: agent.groupe,
        indicateurs_avances: {
            jours_travailles: joursTravailles, jours_repos: joursRepos, jours_conges: joursConges,
            jours_maladie: joursMaladie, jours_autres: joursAutres, jours_feries_travailles: joursFeriesTravailles,
            total_jours: totalJours, taux_presence: parseFloat(tauxPresence.toFixed(1)), shifts_par_jour: shiftsParJour
        },
        jours_travailles_base: statsBase.workedDays, jours_conges_base: statsBase.leaveDays, total_jours_base: statsBase.totalDays
    };
}

function obtenirClassementGroupe(groupe, mois, annee) {
    const agentsGroupe = agents.filter(a => a.groupe === groupe && a.statut === 'actif');
    if (agentsGroupe.length === 0) return { erreur: `Aucun agent dans le groupe ${groupe}` };
    const classement = agentsGroupe.map(agent => {
        const stats = calculateWorkedDays(agent.code, mois, annee);
        return { code: agent.code, nom: agent.nom, prenom: agent.prenom, nom_complet: `${agent.nom} ${agent.prenom}`, cpa: stats.workedDays };
    });
    classement.sort((a,b) => b.cpa - a.cpa);
    classement.forEach((agent, idx) => agent.rang = idx + 1);
    return { groupe, mois, annee, classement, total_agents: classement.length };
}

function obtenirEvolutionMensuelle(agentCode, nbMois = 6) {
    const today = new Date();
    let moisActuel = today.getMonth() + 1, anneeActuelle = today.getFullYear();
    const evolution = [];
    for (let i = 0; i < nbMois; i++) {
        let moisCalc = moisActuel - i, anneeCalc = anneeActuelle;
        if (moisCalc <= 0) { moisCalc += 12; anneeCalc--; }
        const stats = calculateWorkedDays(agentCode, moisCalc, anneeCalc);
        evolution.unshift({ mois: moisCalc, annee: anneeCalc, cpa: stats.workedDays, periode: `${moisCalc.toString().padStart(2,'0')}/${anneeCalc}` });
    }
    let tendance = 0;
    if (evolution.length >= 2) {
        const premier = evolution[0].cpa, dernier = evolution[evolution.length-1].cpa;
        if (premier > 0) tendance = ((dernier - premier) / premier) * 100;
    }
    return { agent: agentCode, evolution, tendance: parseFloat(tendance.toFixed(1)), nb_mois: nbMois };
}

// ==================== MENU PRINCIPAL ====================
function displayMainMenu() {
    const mainContent = document.getElementById('main-content');
    const subTitle = document.getElementById('sub-title');
    if (!mainContent) return;
    if (subTitle) subTitle.textContent = "Menu Principal";
    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'menu-button-container';
    const menus = [
        { text: "👥 GESTION DES AGENTS", handler: () => displayAgentsMenu() },
        { text: "📅 GESTION DU PLANNING", handler: () => displayPlanningMenu() },
        { text: "📊 STATISTIQUES", handler: () => displayStatsMenu() },
        { text: "🏖️ CONGÉS & ABSENCES", handler: () => displayLeavesMenu() },
        { text: "🚨 CODES PANIQUE", handler: () => displayPanicMenu() },
        { text: "📻 GESTION RADIOS", handler: () => displayRadiosMenu() },
        { text: "👔 HABILLEMENT", handler: () => displayUniformMenu() },
        { text: "⚠️ AVERTISSEMENTS", handler: () => displayWarningsMenu() },
        { text: "🎉 JOURS FÉRIÉS", handler: () => displayHolidaysMenu() },
        { text: "💾 EXPORTATIONS", handler: () => displayExportMenu() },
        { text: "⚙️ CONFIGURATION", handler: () => displayConfigMenu() },
        { text: "🚪 QUITTER", handler: () => { if(confirm("Quitter ?")) saveData(); }, className: "quit-button" }
    ];
    menus.forEach(menu => {
        const btn = document.createElement('button');
        btn.textContent = menu.text;
        btn.className = 'menu-button' + (menu.className ? ' ' + menu.className : '');
        btn.onclick = menu.handler;
        container.appendChild(btn);
    });
    mainContent.appendChild(container);
}

function displaySubMenu(title, options) {
    const mainContent = document.getElementById('main-content');
    const subTitle = document.getElementById('sub-title');
    if (!mainContent) return;
    if (subTitle) subTitle.textContent = title;
    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'menu-button-container';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.text;
        btn.className = 'menu-button' + (opt.className ? ' ' + opt.className : '');
        btn.onclick = opt.handler;
        container.appendChild(btn);
    });
    mainContent.appendChild(container);
}

// ==================== GESTION DES AGENTS ====================
function displayAgentsMenu() {
    displaySubMenu("GESTION DES AGENTS", [
        { text: "📋 Liste des Agents", handler: () => showAgentsList() },
        { text: "➕ Ajouter un Agent", handler: () => showAddAgentForm() },
        { text: "✏️ Modifier un Agent", handler: () => showEditAgentList() },
        { text: "🗑️ Supprimer un Agent", handler: () => showDeleteAgentList() },
        { text: "📁 Importer data.js (CleanCo)", handler: () => showImportDataJSForm() },
        { text: "📤 Exporter Agents", handler: () => exportAgentsCSV() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}

function showAgentsList() {
    const html = `<div class="info-section"><input type="text" id="searchAgent" placeholder="Rechercher..." class="form-input" style="margin-bottom:15px;" onkeyup="filterAgentsList()"><div id="agentsListContainer">${generateAgentsTable(agents)}</div></div>`;
    openPopup("Liste des Agents", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function generateAgentsTable(agentsList) {
    if (!agentsList.length) return '<p>Aucun agent</p>';
    return `<table class="classement-table"><thead><th>Code</th><th>Nom</th><th>Groupe</th><th>Statut</th><th>Actions</th></thead><tbody>${agentsList.map(a => `      <tr>
          <td><strong>${a.code}</strong></td>
          <td>${a.nom} ${a.prenom}</td>
          <td>${a.groupe}</td>
          <td><span class="status-badge ${a.statut}">${a.statut}</span></td>
          <td><button class="action-btn small blue" onclick="showEditAgentForm('${a.code}')">✏️</button><button class="action-btn small red" onclick="deleteAgent('${a.code}')">🗑️</button></td>
        </tr>`).join('')}</tbody></table>`;
}
function filterAgentsList() {
    const search = document.getElementById('searchAgent')?.value.toLowerCase() || '';
    const filtered = agents.filter(a => a.nom.toLowerCase().includes(search) || a.code.toLowerCase().includes(search));
    const container = document.getElementById('agentsListContainer');
    if (container) container.innerHTML = generateAgentsTable(filtered);
}
function showAddAgentForm() {
    const html = `<div class="info-section"><form id="addAgentForm"><div class="form-group"><label>Code *</label><input type="text" id="newCode" required></div><div class="form-group"><label>Nom *</label><input type="text" id="newNom" required></div><div class="form-group"><label>Prénom *</label><input type="text" id="newPrenom" required></div><div class="form-group"><label>Groupe *</label><select id="newGroupe"><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select></div><div class="form-group"><label>Téléphone</label><input type="text" id="newTel"></div><div class="form-group"><label>Poste</label><input type="text" id="newPoste"></div><div class="form-group"><label>Date d'entrée</label><input type="date" id="newDateEntree" value="2025-11-01"></div></form></div>`;
    openPopup("Ajouter un Agent", html, `<button class="popup-button green" onclick="addAgent()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function addAgent() {
    const code = document.getElementById('newCode').value.toUpperCase();
    if (agents.find(a => a.code === code)) { showSnackbar("Code déjà existant"); return; }
    agents.push({ code, nom: document.getElementById('newNom').value, prenom: document.getElementById('newPrenom').value, groupe: document.getElementById('newGroupe').value, tel: document.getElementById('newTel').value, poste: document.getElementById('newPoste').value, statut: 'actif', date_entree: document.getElementById('newDateEntree').value || '2025-11-01' });
    saveData();
    showSnackbar("Agent ajouté");
    closePopup();
    showAgentsList();
}
function showEditAgentList() { openPopup("Modifier un Agent", `<div class="info-section">${generateAgentsTable(agents)}</div>`, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>'); }
function showEditAgentForm(code) {
    const agent = agents.find(a => a.code === code);
    if (!agent) return;
    const html = `<div class="info-section"><form id="editAgentForm"><div class="form-group"><label>Code</label><input type="text" value="${agent.code}" disabled></div><div class="form-group"><label>Nom</label><input type="text" id="editNom" value="${agent.nom}"></div><div class="form-group"><label>Prénom</label><input type="text" id="editPrenom" value="${agent.prenom}"></div><div class="form-group"><label>Groupe</label><select id="editGroupe"><option ${agent.groupe==='A'?'selected':''}>A</option><option ${agent.groupe==='B'?'selected':''}>B</option><option ${agent.groupe==='C'?'selected':''}>C</option><option ${agent.groupe==='D'?'selected':''}>D</option><option ${agent.groupe==='E'?'selected':''}>E</option></select></div><div class="form-group"><label>Téléphone</label><input type="text" id="editTel" value="${agent.tel||''}"></div><div class="form-group"><label>Poste</label><input type="text" id="editPoste" value="${agent.poste||''}"></div><div class="form-group"><label>Date d'entrée</label><input type="date" id="editDateEntree" value="${agent.date_entree||'2025-11-01'}"></div></form></div>`;
    openPopup(`Modifier ${code}`, html, `<button class="popup-button green" onclick="updateAgent('${code}')">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function updateAgent(code) {
    const idx = agents.findIndex(a => a.code === code);
    if (idx !== -1) {
        agents[idx].nom = document.getElementById('editNom').value;
        agents[idx].prenom = document.getElementById('editPrenom').value;
        agents[idx].groupe = document.getElementById('editGroupe').value;
        agents[idx].tel = document.getElementById('editTel').value;
        agents[idx].poste = document.getElementById('editPoste').value;
        agents[idx].date_entree = document.getElementById('editDateEntree').value;
        saveData();
        showSnackbar("Agent modifié");
        closePopup();
        showAgentsList();
    }
}
function showDeleteAgentList() {
    const active = agents.filter(a => a.statut === 'actif');
    openPopup("Supprimer un Agent", `<div class="info-section">${generateAgentsTable(active)}</div>`, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function deleteAgent(code) {
    if (confirm("Supprimer cet agent ?")) {
        const idx = agents.findIndex(a => a.code === code);
        if (idx !== -1) {
            agents[idx].statut = 'inactif';
            saveData();
            showSnackbar("Agent marqué inactif");
            showAgentsList();
        }
    }
}

// --- IMPORT DATA.JS AVEC MOT DE PASSE ET CORRECTION ---
function showImportDataJSForm() {
    if (!checkPassword()) { showSnackbar("Mot de passe incorrect"); return; }
    const html = `<div class="info-section"><h3>📁 Importer agents depuis data.js</h3><p>Sélectionnez votre fichier <strong>data.js</strong>.</p>
    <div class="form-group"><label>Fichier data.js</label><input type="file" id="dataJsFile" accept=".js" class="form-input"></div>
    <div class="form-group"><label>Option d'import</label><select id="importDataJsOption"><option value="replace">Remplacer tous les agents</option><option value="merge">Fusionner (mettre à jour si code existe)</option><option value="add">Ajouter (codes en doublon seront ignorés)</option></select></div>
    <div id="dataJsPreview" style="display:none"><h4>Aperçu</h4><div id="dataJsPreviewTable"></div></div></div>`;
    openPopup("Importer data.js", html, `<button class="popup-button green" onclick="processDataJsImport()">Importer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
    const fileInput = document.getElementById('dataJsFile');
    if (fileInput) fileInput.addEventListener('change', previewDataJsFile);
}
function previewDataJsFile() {
    const file = document.getElementById('dataJsFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        let arrayStr = null;
        const agentsMatch = content.match(/const\s+agents\s*=\s*(\[[\s\S]*?\]);/);
        if (agentsMatch) arrayStr = agentsMatch[1];
        else {
            const altMatch = content.match(/agents\s*=\s*(\[[\s\S]*?\]);/);
            if (altMatch) arrayStr = altMatch[1];
        }
        if (!arrayStr) {
            document.getElementById('dataJsPreviewTable').innerHTML = '<p style="color:red">Fichier invalide : agents non trouvé</p>';
            document.getElementById('dataJsPreview').style.display = 'block';
            return;
        }
        arrayStr = arrayStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        try {
            const agentsArray = eval('(' + arrayStr + ')');
            const preview = agentsArray.slice(0, 5);
            let html = `<table class="classement-table"><thead><th>Code</th><th>Nom</th><th>Prénom</th><th>Groupe</th></thead><tbody>`;
            preview.forEach(a => {
                html += `      <tr><td>${a.code}</td><td>${a.nom}</td><td>${a.prenom}</td><td>${a.groupe}</td></tr>`;
            });
            html += `</tbody></table><p>Total: ${agentsArray.length} agents</p>`;
            document.getElementById('dataJsPreviewTable').innerHTML = html;
            document.getElementById('dataJsPreview').style.display = 'block';
        } catch(err) {
            document.getElementById('dataJsPreviewTable').innerHTML = '<p style="color:red">Erreur lors de l\'analyse du fichier</p>';
            document.getElementById('dataJsPreview').style.display = 'block';
        }
    };
    reader.readAsText(file, 'UTF-8');
}
function processDataJsImport() {
    const file = document.getElementById('dataJsFile').files[0];
    if (!file) { showSnackbar("Veuillez sélectionner un fichier data.js"); return; }
    const option = document.getElementById('importDataJsOption').value;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        let arrayStr = null;
        const agentsMatch = content.match(/const\s+agents\s*=\s*(\[[\s\S]*?\]);/);
        if (agentsMatch) arrayStr = agentsMatch[1];
        else {
            const altMatch = content.match(/agents\s*=\s*(\[[\s\S]*?\]);/);
            if (altMatch) arrayStr = altMatch[1];
        }
        if (!arrayStr) { showSnackbar("Fichier invalide : agents non trouvé"); return; }
        arrayStr = arrayStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        try {
            const importedAgents = eval('(' + arrayStr + ')');
            if (!Array.isArray(importedAgents)) { showSnackbar("Le tableau d'agents n'est pas valide"); return; }
            let added = 0, updated = 0, skipped = 0;
            if (option === 'replace') agents = [];
            importedAgents.forEach(newAgent => {
                if (!newAgent.code || !newAgent.nom || !newAgent.prenom || !newAgent.groupe) { skipped++; return; }
                const existingIndex = agents.findIndex(a => a.code === newAgent.code);
                if (existingIndex !== -1) {
                    if (option === 'merge') {
                        agents[existingIndex] = { ...agents[existingIndex], ...newAgent };
                        updated++;
                    } else if (option === 'add') {
                        let newCode = newAgent.code, counter = 1;
                        while (agents.find(a => a.code === newCode)) newCode = `${newAgent.code}_${counter++}`;
                        newAgent.code = newCode;
                        agents.push(newAgent);
                        added++;
                    } else skipped++;
                } else { agents.push(newAgent); added++; }
            });
            saveData();
            showSnackbar(`Import terminé : ${added} ajoutés, ${updated} mis à jour, ${skipped} ignorés`);
            closePopup();
            showAgentsList();
        } catch(err) { showSnackbar("Erreur lors de l'import : " + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
}

// ==================== GESTION DU PLANNING (avec export Excel) ====================
function displayPlanningMenu() {
    displaySubMenu("GESTION DU PLANNING", [
        { text: "📅 Planning Mensuel", handler: () => showMonthlyPlanning() },
        { text: "👤 Planning par Agent", handler: () => showAgentPlanningSelector() },
        { text: "📊 Exporter Planning (Excel)", handler: () => showExportPlanningMenu() },
        { text: "✏️ Modifier Shift", handler: () => showShiftModificationForm() },
        { text: "🔄 Échanger Shifts", handler: () => showShiftExchangeForm() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showMonthlyPlanning() {
    const today = new Date();
    const html = `<div class="info-section"><div class="form-group"><label>Mois</label><select id="planMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===today.getMonth()+1?'selected':''}>${getMonthName(i+1)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Année</label><input type="number" id="planYear" value="${today.getFullYear()}"></div></div>`;
    openPopup("Planning Mensuel", html, `<button class="popup-button green" onclick="generatePlanningView()">Voir</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function generatePlanningView() {
    const month = parseInt(document.getElementById('planMonth').value);
    const year = parseInt(document.getElementById('planYear').value);
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const daysInMonth = new Date(year, month, 0).getDate();
    let html = `<div class="info-section"><h3>Planning ${getMonthName(month)} ${year}</h3><div style="overflow-x:auto"><table class="planning-table"><thead><th>Agent</th>`;
    for (let d=1; d<=daysInMonth; d++) {
        const date = new Date(year, month-1, d);
        const isHoliday = isHolidayDate(date);
        html += `<th class="${isHoliday?'holiday':''}">${d}<br>${JOURS_FRANCAIS[date.getDay()].substring(0,2)}</th>`;
    }
    html += `<th>Total</th></thead><tbody>`;
    activeAgents.forEach(agent => {
        const stats = calculateWorkedDays(agent.code, month, year);
        html += `<tr><td><strong>${agent.code}</strong><br><small>${agent.nom}</small></td>`;
        for (let d=1; d<=daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const shift = getShiftForAgent(agent.code, dateStr);
            const date = new Date(year, month-1, d);
            const isHoliday = isHolidayDate(date);
            html += `<td class="shift-cell" style="background:${SHIFT_COLORS[shift]};color:white" title="${SHIFT_LABELS[shift]}${isHoliday?' - Férié':''}" onclick="showShiftModification('${agent.code}','${dateStr}')">${shift}</td>`;
        }
        html += `<td style="background:#34495e"><strong>${stats.totalDays} j</strong><br><small>${stats.workedDays} travaillés<br>+${stats.holidayWorkedDays} fériés</small></td></tr>`;
    });
    html += `</tbody></table></div><div class="info-section"><h4>Légende:</h4>${Object.entries(SHIFT_LABELS).map(([k,v])=>`<span style="display:inline-block;margin:5px;padding:2px 8px;background:${SHIFT_COLORS[k]};border-radius:12px">${k}=${v}</span>`).join('')}<br><span style="background:#e74c3c">📅 Jours fériés</span><br><span style="background:#2ecc71">📊 Total = travaillés + fériés travaillés</span></div></div>`;
    openPopup(`Planning ${getMonthName(month)} ${year}`, html, `<button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function showAgentPlanningSelector() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="apAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}</select></div>
    <div class="form-group"><label>Mois</label><select id="apMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${getMonthName(i+1)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Année</label><input type="number" id="apYear" value="${new Date().getFullYear()}"></div></div>`;
    openPopup("Planning par Agent", html, `<button class="popup-button green" onclick="showAgentPlanningView()">Voir</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function showAgentPlanningView() {
    const agentCode = document.getElementById('apAgent').value;
    const month = parseInt(document.getElementById('apMonth').value);
    const year = parseInt(document.getElementById('apYear').value);
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    const daysInMonth = new Date(year, month, 0).getDate();
    const stats = calculateWorkedDays(agentCode, month, year);
    let html = `<div class="info-section"><h3>Planning de ${agent.nom} ${agent.prenom} (${agent.code})</h3><p><strong>Groupe:</strong> ${agent.groupe} | <strong>Poste:</strong> ${agent.poste || 'Non spécifié'}</p>`;
    html += `<div style="background:#34495e;padding:10px;border-radius:8px;margin-bottom:15px"><strong>Statistiques du mois:</strong><br>📊 Total jours = ${stats.totalDays} (${stats.workedDays} travaillés + ${stats.holidayWorkedDays} fériés)<br>📅 Jours fériés travaillés: ${stats.holidayWorkedDays}<br>⚠️ Congés dimanches (non comptés): ${stats.sundayLeaves}<br>🚫 Congés (non comptabilisés): ${stats.leaveDays}</div>`;
    html += `<table class="planning-table"><thead><th>Date</th><th>Jour</th><th>Shift</th><th>Description</th><th>Actions</th></thead><tbody>`;
    for (let d=1; d<=daysInMonth; d++) {
        const date = new Date(year, month-1, d);
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const shift = getShiftForAgent(agentCode, dateStr);
        const isHoliday = isHolidayDate(date);
        const isSunday = date.getDay() === 0;
        const isWorkDay = (shift === '1' || shift === '2' || shift === '3');
        const isLeave = (shift === 'C' || shift === 'M' || shift === 'A');
        let extraInfo = '';
        if (isHoliday && isWorkDay) extraInfo = ' 🎉 Férié travaillé';
        if (isLeave && isSunday) extraInfo = ' ⚠️ Congé dimanche (non compté)';
        html += `<tr><td>${dateStr}</td><td class="${isSunday?'sunday':''}">${JOURS_FRANCAIS[date.getDay()]}${isHoliday?' 🎉':''}</td><td style="background:${SHIFT_COLORS[shift]};color:white;text-align:center">${shift}</td><td>${SHIFT_LABELS[shift]}${extraInfo}</td><td><button class="action-btn small blue" onclick="showShiftModification('${agentCode}','${dateStr}')">✏️</button><button class="action-btn small red" onclick="showAddLeaveForDate('${agentCode}','${dateStr}')">🚫</button></td></tr>`;
    }
    html += `</tbody></table></div>`;
    openPopup(`Planning ${agent.code}`, html, `<button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function showShiftModification(agentCode, dateStr) {
    const currentShift = getShiftForAgent(agentCode, dateStr);
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><input type="text" value="${agentCode}" readonly></div><div class="form-group"><label>Date</label><input type="text" value="${dateStr}" readonly></div><div class="form-group"><label>Shift actuel</label><input type="text" value="${SHIFT_LABELS[currentShift]} (${currentShift})" readonly></div><div class="form-group"><label>Nouveau shift</label><select id="newShiftValue">${Object.entries(SHIFT_LABELS).map(([k,v])=>`<option value="${k}" ${k===currentShift?'selected':''}>${k} - ${v}</option>`).join('')}</select></div></div>`;
    openPopup("Modifier Shift", html, `<button class="popup-button green" onclick="applyShiftModificationDirect('${agentCode}','${dateStr}')">Appliquer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function applyShiftModificationDirect(agentCode, dateStr) {
    const newShift = document.getElementById('newShiftValue').value;
    const monthKey = dateStr.substring(0,7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    planningData[monthKey][agentCode][dateStr] = { shift: newShift, type: 'modification', modified_at: new Date().toISOString() };
    saveData();
    showSnackbar("Shift modifié");
    closePopup();
    showAgentPlanningView();
}
function showShiftModificationForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="shiftAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Date</label><input type="date" id="shiftDate" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Nouveau shift</label><select id="newShift">${Object.entries(SHIFT_LABELS).map(([k,v])=>`<option value="${k}">${k} - ${v}</option>`).join('')}</select></div></div>`;
    openPopup("Modifier Shift", html, `<button class="popup-button green" onclick="applyShiftModification()">Appliquer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function applyShiftModification() {
    const agentCode = document.getElementById('shiftAgent').value;
    const dateStr = document.getElementById('shiftDate').value;
    const newShift = document.getElementById('newShift').value;
    const monthKey = dateStr.substring(0,7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    planningData[monthKey][agentCode][dateStr] = { shift: newShift, type: 'modification', modified_at: new Date().toISOString() };
    saveData();
    showSnackbar("Shift modifié");
    closePopup();
}
function showShiftExchangeForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent 1</label><select id="exAgent1">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Date 1</label><input type="date" id="exDate1"></div>
    <div class="form-group"><label>Agent 2</label><select id="exAgent2">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Date 2</label><input type="date" id="exDate2"></div></div>`;
    openPopup("Échanger Shifts", html, `<button class="popup-button green" onclick="executeShiftExchange()">Échanger</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function executeShiftExchange() {
    const a1 = document.getElementById('exAgent1').value, d1 = document.getElementById('exDate1').value;
    const a2 = document.getElementById('exAgent2').value, d2 = document.getElementById('exDate2').value;
    if (!d1 || !d2) { showSnackbar("Veuillez sélectionner les dates"); return; }
    const s1 = getShiftForAgent(a1, d1), s2 = getShiftForAgent(a2, d2);
    const m1 = d1.substring(0,7), m2 = d2.substring(0,7);
    if (!planningData[m1]) planningData[m1] = {};
    if (!planningData[m1][a1]) planningData[m1][a1] = {};
    planningData[m1][a1][d1] = { shift: s2, type: 'echange' };
    if (!planningData[m2]) planningData[m2] = {};
    if (!planningData[m2][a2]) planningData[m2][a2] = {};
    planningData[m2][a2][d2] = { shift: s1, type: 'echange' };
    saveData();
    showSnackbar("Échange effectué");
    closePopup();
}
function showExportPlanningMenu() {
    const html = `
        <div class="info-section">
            <h3>📊 Exporter le planning en Excel</h3>
            <div class="form-group"><label>Type d'export</label><select id="exportType"><option value="global">Planning global</option><option value="groupe">Par groupe</option><option value="agent">Par agent</option></select></div>
            <div id="exportGroupDiv" style="display:none"><div class="form-group"><label>Groupe</label><select id="exportGroup"><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select></div></div>
            <div id="exportAgentDiv" style="display:none"><div class="form-group"><label>Agent</label><select id="exportAgent">${agents.filter(a=>a.statut==='actif').map(a=>`<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}</select></div></div>
            <div class="form-group"><label>Mois</label><select id="exportMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${getMonthName(i+1)}</option>`).join('')}</select></div>
            <div class="form-group"><label>Année</label><input type="number" id="exportYear" value="${new Date().getFullYear()}"></div>
        </div>`;
    openPopup("Exporter Planning (Excel)", html, `<button class="popup-button green" onclick="exportPlanningToExcel()">📥 Exporter</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
    const exportType = document.getElementById('exportType');
    exportType.addEventListener('change', () => {
        const val = exportType.value;
        document.getElementById('exportGroupDiv').style.display = val === 'groupe' ? 'block' : 'none';
        document.getElementById('exportAgentDiv').style.display = val === 'agent' ? 'block' : 'none';
    });
}
function exportPlanningToExcel() {
    const type = document.getElementById('exportType').value;
    const month = parseInt(document.getElementById('exportMonth').value);
    const year = parseInt(document.getElementById('exportYear').value);
    let agentsToExport = [];

    if (type === 'global') agentsToExport = agents.filter(a => a.statut === 'actif');
    else if (type === 'groupe') {
        const group = document.getElementById('exportGroup').value;
        agentsToExport = agents.filter(a => a.groupe === group && a.statut === 'actif');
    } else {
        const agentCode = document.getElementById('exportAgent').value;
        const agent = agents.find(a => a.code === agentCode);
        if (agent) agentsToExport = [agent];
    }

    if (agentsToExport.length === 0) {
        showSnackbar("Aucun agent à exporter");
        return;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const data = [];
    const headers = ['Agent', 'Code', 'Groupe'];
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month-1, d);
        const dayName = JOURS_FRANCAIS[date.getDay()];
        headers.push(`${d} (${dayName})`);
    }
    headers.push('Total', 'Travaillés', 'Fériés', 'Congés');
    data.push(headers);

    agentsToExport.forEach(agent => {
        const stats = calculateWorkedDays(agent.code, month, year);
        const row = [agent.nom + ' ' + agent.prenom, agent.code, agent.groupe];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const shift = getShiftForAgent(agent.code, dateStr);
            row.push(shift);
        }
        row.push(stats.totalDays, stats.workedDays, stats.holidayWorkedDays, stats.leaveDays);
        data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning');
    const filename = `planning_${type}_${getMonthName(month)}_${year}.xlsx`;
    XLSX.writeFile(wb, filename);
    showSnackbar("Export Excel terminé");
    closePopup();
}

// ==================== STATISTIQUES ====================
function displayStatsMenu() {
    displaySubMenu("STATISTIQUES", [
        { text: "📈 Statistiques Globales", handler: () => showGlobalStats() },
        { text: "👤 Stats par Agent", handler: () => showAgentStatsSelector() },
        { text: "🏆 Classement des Agents", handler: () => showRanking() },
        { text: "📊 Statistiques Avancées", handler: () => showAdvancedAgentStats() },
        { text: "🏆 Classement par Groupe", handler: () => showGroupRanking() },
        { text: "📈 Évolution Mensuelle", handler: () => showMonthlyEvolution() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showGlobalStats() {
    const active = agents.filter(a => a.statut === 'actif');
    const today = new Date();
    const month = today.getMonth()+1, year = today.getFullYear();
    let totalWorked=0, totalDays=0, totalLeaves=0, totalHolidayWorked=0;
    const groups = {};
    active.forEach(a => {
        groups[a.groupe] = (groups[a.groupe]||0)+1;
        const stats = calculateWorkedDays(a.code, month, year);
        totalWorked += stats.workedDays;
        totalDays += stats.totalDays;
        totalLeaves += stats.leaveDays;
        totalHolidayWorked += stats.holidayWorkedDays;
    });
    const avgRate = totalDays ? Math.round(totalWorked/totalDays*100) : 0;
    const html = `<div class="info-section"><h3>Statistiques Globales - ${getMonthName(month)} ${year}</h3>
        <p><strong>Agents actifs:</strong> ${active.length}</p>
        <p><strong>Total jours:</strong> ${totalDays} (${totalWorked} travaillés + ${totalHolidayWorked} fériés)</p>
        <p><strong>Taux de présence:</strong> ${avgRate}%</p>
        <p><strong>Jours fériés travaillés:</strong> ${totalHolidayWorked}</p>
        <p><strong>Congés non comptabilisés:</strong> ${totalLeaves}</p>
        <p><strong>Répartition:</strong> ${Object.entries(groups).map(([g,c])=>`Groupe ${g}: ${c}`).join(' | ')}</p>
        <p><small>📌 Total = travaillés (shifts 1,2,3) + fériés travaillés</small></p></div>`;
    openPopup("Statistiques Globales", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function showAgentStatsSelector() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><select id="statsAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select><div id="statsResult"></div></div>`;
    openPopup("Statistiques Agent", html, `<button class="popup-button green" onclick="showAgentStats()">Voir</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function showAgentStats() {
    const agentCode = document.getElementById('statsAgent').value;
    const agent = agents.find(a => a.code === agentCode);
    if (!agent) return;
    const today = new Date();
    const month = today.getMonth()+1, year = today.getFullYear();
    const stats = calculateWorkedDays(agentCode, month, year);
    const html = `<div><p><strong>${agent.nom} ${agent.prenom}</strong> (${agent.code}) - Groupe ${agent.groupe}</p>
        <p><strong>Statistiques ${getMonthName(month)} ${year}:</strong></p>
        <p>📊 Total jours = ${stats.totalDays} (${stats.workedDays} travaillés + ${stats.holidayWorkedDays} fériés)</p>
        <p>📅 Jours fériés travaillés: ${stats.holidayWorkedDays}</p>
        <p>⚠️ Congés dimanches (non comptés): ${stats.sundayLeaves}</p>
        <p>🚫 Congés (non comptabilisés): ${stats.leaveDays}</p>
        <p>🎯 Taux de présence: ${Math.round(stats.workedDays/stats.totalDays*100)}%</p></div>`;
    document.getElementById('statsResult').innerHTML = html;
}
function showRanking() {
    const today = new Date();
    const month = today.getMonth()+1, year = today.getFullYear();
    const ranking = agents.filter(a => a.statut === 'actif').map(a => ({ ...a, stats: calculateWorkedDays(a.code, month, year) })).sort((a,b) => b.stats.totalDays - a.stats.totalDays);
    const html = `<div class="info-section"><h3>Classement des Agents - ${getMonthName(month)} ${year}</h3>
        <p><small>Classement basé sur le total jours = travaillés + fériés travaillés</small></p>
        <table class="classement-table"><thead><th>Rang</th><th>Agent</th><th>Groupe</th><th>Total jours</th><th>Travaillés</th><th>Fériés</th><th>Congés</th><th>Taux</th></thead><tbody>${ranking.map((a,i)=>`<tr><td class="rank-${i+1}">${i+1}</td><td><strong>${a.nom} ${a.prenom}</strong><br><small>${a.code}</small></td><td>${a.groupe}</td><td class="total-value">${a.stats.totalDays}</td><td>${a.stats.workedDays}</td><td>${a.stats.holidayWorkedDays}</td><td>${a.stats.leaveDays}</td><td>${Math.round(a.stats.workedDays/a.stats.totalDays*100)}%</td></tr>`).join('')}</tbody></table></div>`;
    openPopup("Classement des Agents", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function showAdvancedAgentStats() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="advStatsAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Mois</label><select id="advStatsMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${getMonthName(i+1)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Année</label><input type="number" id="advStatsYear" value="${new Date().getFullYear()}"></div>
    <div id="advStatsResult"></div></div>`;
    openPopup("Statistiques Avancées", html, `<button class="popup-button green" onclick="afficherStatsAvancees()">Analyser</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function afficherStatsAvancees() {
    const agentCode = document.getElementById('advStatsAgent').value;
    const mois = parseInt(document.getElementById('advStatsMonth').value);
    const annee = parseInt(document.getElementById('advStatsYear').value);
    const stats = obtenirStatsDetailleesAgent(agentCode, mois, annee);
    if (stats.erreur) { document.getElementById('advStatsResult').innerHTML = `<p style="color:red">${stats.erreur}</p>`; return; }
    const ind = stats.indicateurs_avances;
    let shiftsTable = '<h4>Répartition des shifts par jour de semaine</h4><table class="classement-table"><thead><th>Jour</th><th>Matin</th><th>Après-midi</th><th>Nuit</th><th>Repos</th><th>Congé</th><th>Maladie</th><th>Autre</th></thead><tbody>';
    for (const [jour, counts] of Object.entries(ind.shifts_par_jour)) {
        shiftsTable += `<tr><td>${jour}</td><td>${counts['1']}</td><td>${counts['2']}</td><td>${counts['3']}</td><td>${counts['R']}</td><td>${counts['C']}</td><td>${counts['M']}</td><td>${counts['A']}</td></tr>`;
    }
    shiftsTable += '</tbody></table>';
    const html = `<div><p><strong>${stats.nom_complet}</strong> (${stats.agent}) - Groupe ${stats.groupe}</p><p>Période : ${getMonthName(mois)} ${annee}</p><hr>
    <ul><li>Jours travaillés (shifts 1,2,3) : ${ind.jours_travailles}</li><li>Jours de repos (R) : ${ind.jours_repos}</li><li>Congés (C) : ${ind.jours_conges}</li><li>Maladie (M) : ${ind.jours_maladie}</li><li>Autres absences (A) : ${ind.jours_autres}</li><li>Jours fériés travaillés : ${ind.jours_feries_travailles}</li><li>Total jours (travaillés + fériés) : ${ind.total_jours}</li><li>Taux de présence : ${ind.taux_presence}%</li></ul>${shiftsTable}<p><small>Les congés ne sont pas comptabilisés dans le total.</small></p></div>`;
    document.getElementById('advStatsResult').innerHTML = html;
}
function showGroupRanking() {
    const groups = ['A','B','C','D','E'];
    const html = `<div class="info-section"><div class="form-group"><label>Groupe</label><select id="rankGroup">${groups.map(g=>`<option value="${g}">Groupe ${g}</option>`).join('')}</select></div>
    <div class="form-group"><label>Mois</label><select id="rankMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${getMonthName(i+1)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Année</label><input type="number" id="rankYear" value="${new Date().getFullYear()}"></div>
    <div id="rankResult"></div></div>`;
    openPopup("Classement par Groupe", html, `<button class="popup-button green" onclick="afficherClassementGroupe()">Voir</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function afficherClassementGroupe() {
    const groupe = document.getElementById('rankGroup').value;
    const mois = parseInt(document.getElementById('rankMonth').value);
    const annee = parseInt(document.getElementById('rankYear').value);
    const classement = obtenirClassementGroupe(groupe, mois, annee);
    if (classement.erreur) { document.getElementById('rankResult').innerHTML = `<p style="color:red">${classement.erreur}</p>`; return; }
    let table = `<h3>Classement Groupe ${groupe} - ${getMonthName(mois)} ${annee}</h3><table class="classement-table"><thead><th>Rang</th><th>Agent</th><th>CPA</th></thead><tbody>`;
    classement.classement.forEach(a => { table += `<tr><td class="rank-${a.rang}">${a.rang}</td><td>${a.nom_complet}</td><td>${a.cpa}</td></tr>`; });
    table += '</tbody></table>';
    document.getElementById('rankResult').innerHTML = table;
}
function showMonthlyEvolution() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="evolAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Nombre de mois</label><input type="number" id="evolMonths" value="6" min="1" max="12"></div>
    <div id="evolResult"></div></div>`;
    openPopup("Évolution Mensuelle", html, `<button class="popup-button green" onclick="afficherEvolution()">Analyser</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function afficherEvolution() {
    const agentCode = document.getElementById('evolAgent').value;
    const nbMois = parseInt(document.getElementById('evolMonths').value);
    const evol = obtenirEvolutionMensuelle(agentCode, nbMois);
    let table = `<h3>Évolution mensuelle de ${agentCode}</h3><table class="classement-table"><thead><th>Période</th><th>CPA</th></thead><tbody>`;
    evol.evolution.forEach(e => { table += `<tr><td>${e.periode}</td><td>${e.cpa}</td></tr>`; });
    table += '</tbody></table>';
    const tendanceColor = evol.tendance >= 0 ? '#27ae60' : '#e74c3c';
    table += `<p><strong>Tendance :</strong> <span style="color:${tendanceColor}">${evol.tendance}%</span> sur ${nbMois} mois</p>`;
    document.getElementById('evolResult').innerHTML = table;
}

// ==================== CONGÉS & ABSENCES (simplifié) ====================
function displayLeavesMenu() {
    displaySubMenu("CONGÉS & ABSENCES", [
        { text: "➕ Ajouter Congé (simple)", handler: () => showAddLeaveForm() },
        { text: "📅 Ajouter Congé (période)", handler: () => showAddPeriodLeaveForm() },
        { text: "🗑️ Supprimer un Congé", handler: () => showDeleteLeaveForm() },
        { text: "📋 Liste des Congés", handler: () => showLeavesList() },
        { text: "📅 Congés par Agent", handler: () => showAgentLeavesSelection() },
        { text: "📊 Congés par Groupe", handler: () => showGroupLeavesSelection() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddLeaveForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Type d'absence:</label><select id="leaveType"><option value="C">Congé payé (C)</option><option value="M">Maladie (M)</option><option value="A">Autre absence (A)</option><option value="periode">Congé sur période</option></select></div>
    <div class="form-group"><label>Agent</label><select id="leaveAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom} (${a.code}) - Groupe ${a.groupe}</option>`).join('')}</select></div>
    <div id="singleLeaveSection"><div class="form-group"><label>Date</label><input type="date" id="leaveDate" value="${new Date().toISOString().split('T')[0]}"></div></div>
    <div id="periodLeaveSection" style="display:none"><div style="display:grid;grid-template-columns:1fr 1fr;gap:15px"><div class="form-group"><label>Date début</label><input type="date" id="leaveStartDate"></div><div class="form-group"><label>Date fin</label><input type="date" id="leaveEndDate"></div></div><div class="form-group"><label>Gestion des dimanches</label><select id="sundayHandling"><option value="repos">Dimanches restent en repos (R)</option><option value="conge">Dimanches comptent comme congé (C)</option></select></div></div>
    <div class="form-group"><label>Commentaire</label><textarea id="leaveComment" rows="2"></textarea></div></div>`;
    openPopup("Ajouter Congé/Absence", html, `<button class="popup-button green" onclick="saveLeave()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
    document.getElementById('leaveType').addEventListener('change', function() {
        const type = this.value;
        document.getElementById('singleLeaveSection').style.display = type === 'periode' ? 'none' : 'block';
        document.getElementById('periodLeaveSection').style.display = type === 'periode' ? 'block' : 'none';
    });
}
function saveLeave() {
    const leaveType = document.getElementById('leaveType').value;
    const agentCode = document.getElementById('leaveAgent').value;
    const comment = document.getElementById('leaveComment').value;
    if (leaveType === 'periode') {
        const startDate = document.getElementById('leaveStartDate').value;
        const endDate = document.getElementById('leaveEndDate').value;
        const sundayHandling = document.getElementById('sundayHandling').value;
        if (!startDate || !endDate) { showSnackbar("Veuillez spécifier les dates"); return; }
        if (new Date(startDate) > new Date(endDate)) { showSnackbar("La date de début doit être avant la fin"); return; }
        const leaveRecord = { id: 'L'+Date.now(), agent_code: agentCode, type: 'C', start_date: startDate, end_date: endDate, sunday_handling: sundayHandling, comment, created_at: new Date().toISOString(), status: 'active' };
        if (!leaves) leaves = [];
        leaves.push(leaveRecord);
        applyPeriodLeave(agentCode, startDate, endDate, sundayHandling);
        showSnackbar(`Congé sur période enregistré pour ${agentCode} du ${startDate} au ${endDate}`);
    } else {
        const leaveDate = document.getElementById('leaveDate').value;
        if (!leaveDate) { showSnackbar("Veuillez spécifier une date"); return; }
        const monthKey = leaveDate.substring(0,7);
        if (!planningData[monthKey]) planningData[monthKey] = {};
        if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
        planningData[monthKey][agentCode][leaveDate] = { shift: leaveType, type: 'absence', comment, recorded_at: new Date().toISOString() };
        showSnackbar(`Absence (${SHIFT_LABELS[leaveType]}) enregistrée pour ${agentCode} le ${leaveDate}`);
    }
    saveData();
    closePopup();
}
function applyPeriodLeave(agentCode, startDate, endDate, sundayHandling) {
    const start = new Date(startDate), end = new Date(endDate);
    let current = new Date(start);
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getDay();
        let shiftType = 'C';
        if (dayOfWeek === 0) shiftType = sundayHandling === 'repos' ? 'R' : 'C';
        const monthKey = dateStr.substring(0,7);
        if (!planningData[monthKey]) planningData[monthKey] = {};
        if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
        planningData[monthKey][agentCode][dateStr] = { shift: shiftType, type: 'congé_periode', period_id: 'L'+Date.now(), recorded_at: new Date().toISOString() };
        current.setDate(current.getDate() + 1);
    }
}
function showLeavesList() {
    const leavesByAgent = {};
    Object.keys(planningData).forEach(monthKey => {
        Object.keys(planningData[monthKey]).forEach(agentCode => {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C','M','A'].includes(record.shift)) {
                    if (!leavesByAgent[agentCode]) leavesByAgent[agentCode] = [];
                    leavesByAgent[agentCode].push({ date: dateStr, type: record.shift, comment: record.comment||'', recorded_at: record.recorded_at });
                }
            });
        });
    });
    if (leaves) leaves.forEach(leave => {
        if (!leavesByAgent[leave.agent_code]) leavesByAgent[leave.agent_code] = [];
        leavesByAgent[leave.agent_code].push({ date: `${leave.start_date} au ${leave.end_date}`, type: 'Période', comment: leave.comment||'', recorded_at: leave.created_at, is_period: true });
    });
    const html = `<div class="info-section"><h3>Liste des congés et absences</h3><div style="margin-bottom:15px"><select id="leavesFilter" onchange="filterLeavesList()"><option value="all">Tous les agents</option>${agents.filter(a=>a.statut==='actif').map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select>
    <select id="leavesTypeFilter" onchange="filterLeavesList()" style="margin-left:10px"><option value="all">Tous les types</option><option value="C">Congés</option><option value="M">Maladie</option><option value="A">Autre</option><option value="Période">Périodes</option></select></div>
    <div id="leavesListContainer">${generateLeavesList(leavesByAgent)}</div></div>`;
    openPopup("Liste des Congés/Absences", html, `<button class="popup-button green" onclick="showAddLeaveForm()">➕ Ajouter</button><button class="popup-button blue" onclick="exportLeavesReport()">📊 Exporter</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function generateLeavesList(leavesByAgent, filterAgent='all', filterType='all') {
    let html = '';
    Object.keys(leavesByAgent).forEach(agentCode => {
        const agent = agents.find(a=>a.code===agentCode);
        if (!agent) return;
        if (filterAgent !== 'all' && agentCode !== filterAgent) return;
        const agentLeaves = leavesByAgent[agentCode].filter(l => {
            if (filterType === 'all') return true;
            if (filterType === 'Période') return l.is_period;
            return l.type === filterType;
        });
        if (!agentLeaves.length) return;
        html += `<div style="margin-bottom:20px;padding:15px;background:#34495e;border-radius:5px"><h4>${agent.nom} ${agent.prenom} (${agent.code})</h4><table class="classement-table"><thead><th>Date(s)</th><th>Type</th><th>Commentaire</th><th>Enregistré le</th><th>Actions</th></thead><tbody>${agentLeaves.map(l => `<tr><td>${l.date}</td><td><span style="background:${SHIFT_COLORS[l.type]||'#7f8c8d'};color:white;padding:2px 8px;border-radius:3px">${l.type}</span></td><td>${l.comment||'-'}</td><td>${new Date(l.recorded_at).toLocaleDateString()}</td><td>${l.is_period ? `<button class="action-btn small red" onclick="deletePeriodLeave('${agentCode}','${l.date.split(' au ')[0]}')">🗑️</button>` : `<button class="action-btn small red" onclick="deleteSingleLeave('${agentCode}','${l.date}')">🗑️</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    });
    return html || '<p>Aucun congé ou absence trouvé</p>';
}
function filterLeavesList() {
    const filterAgent = document.getElementById('leavesFilter').value;
    const filterType = document.getElementById('leavesTypeFilter').value;
    const leavesByAgent = {};
    Object.keys(planningData).forEach(monthKey => {
        Object.keys(planningData[monthKey]).forEach(agentCode => {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C','M','A'].includes(record.shift)) {
                    if (!leavesByAgent[agentCode]) leavesByAgent[agentCode] = [];
                    leavesByAgent[agentCode].push({ date: dateStr, type: record.shift, comment: record.comment||'', recorded_at: record.recorded_at });
                }
            });
        });
    });
    if (leaves) leaves.forEach(leave => {
        if (!leavesByAgent[leave.agent_code]) leavesByAgent[leave.agent_code] = [];
        leavesByAgent[leave.agent_code].push({ date: `${leave.start_date} au ${leave.end_date}`, type: 'Période', comment: leave.comment||'', recorded_at: leave.created_at, is_period: true });
    });
    document.getElementById('leavesListContainer').innerHTML = generateLeavesList(leavesByAgent, filterAgent, filterType);
}
function deleteSingleLeave(agentCode, dateStr) {
    if (!confirm(`Supprimer l'absence de ${agentCode} du ${dateStr} ?`)) return;
    const monthKey = dateStr.substring(0,7);
    if (planningData[monthKey]?.[agentCode]?.[dateStr]) {
        delete planningData[monthKey][agentCode][dateStr];
        saveData();
        showSnackbar(`Absence supprimée pour ${agentCode} le ${dateStr}`);
        showLeavesList();
    }
}
function deletePeriodLeave(agentCode, startDate) {
    if (!confirm(`Supprimer le congé sur période de ${agentCode} commençant le ${startDate} ?`)) return;
    if (leaves) {
        const leaveIndex = leaves.findIndex(l => l.agent_code === agentCode && l.start_date === startDate);
        if (leaveIndex !== -1) {
            const leave = leaves[leaveIndex];
            const start = new Date(leave.start_date), end = new Date(leave.end_date);
            let current = new Date(start);
            while (current <= end) {
                const dateStr = current.toISOString().split('T')[0];
                const monthKey = dateStr.substring(0,7);
                if (planningData[monthKey]?.[agentCode]?.[dateStr]) delete planningData[monthKey][agentCode][dateStr];
                current.setDate(current.getDate() + 1);
            }
            leaves.splice(leaveIndex, 1);
            saveData();
            showSnackbar(`Congé sur période supprimé pour ${agentCode}`);
            showLeavesList();
        }
    }
}
function showAgentLeavesSelection() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="leavesAgentSelect">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}</select></div>
    <div class="form-group"><label>Période</label><select id="leavesPeriod"><option value="month">Ce mois</option><option value="last_month">Mois dernier</option><option value="quarter">Ce trimestre</option><option value="year">Cette année</option><option value="all">Toute période</option></select></div></div>`;
    openPopup("Congés par Agent", html, `<button class="popup-button green" onclick="showSelectedAgentLeaves()">Voir</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function showSelectedAgentLeaves() {
    const agentCode = document.getElementById('leavesAgentSelect').value;
    const period = document.getElementById('leavesPeriod').value;
    const today = new Date();
    let startDate, endDate;
    switch(period) {
        case 'month': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth()+1, 0); break;
        case 'last_month': startDate = new Date(today.getFullYear(), today.getMonth()-1, 1); endDate = new Date(today.getFullYear(), today.getMonth(), 0); break;
        case 'quarter': const q = Math.floor(today.getMonth()/3); startDate = new Date(today.getFullYear(), q*3, 1); endDate = new Date(today.getFullYear(), (q+1)*3, 0); break;
        case 'year': startDate = new Date(today.getFullYear(), 0, 1); endDate = new Date(today.getFullYear(), 11, 31); break;
        default: startDate = new Date(2020,0,1); endDate = new Date(2030,11,31);
    }
    const agentLeaves = [];
    Object.keys(planningData).forEach(monthKey => {
        if (planningData[monthKey][agentCode]) {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C','M','A'].includes(record.shift)) {
                    const date = new Date(dateStr);
                    if (date >= startDate && date <= endDate) agentLeaves.push({ date: dateStr, type: record.shift, comment: record.comment||'', recorded_at: record.recorded_at });
                }
            });
        }
    });
    if (leaves) leaves.filter(l => l.agent_code === agentCode).forEach(leave => {
        const leaveStart = new Date(leave.start_date), leaveEnd = new Date(leave.end_date);
        if ((leaveStart >= startDate && leaveStart <= endDate) || (leaveEnd >= startDate && leaveEnd <= endDate) || (leaveStart <= startDate && leaveEnd >= endDate)) {
            agentLeaves.push({ date: `${leave.start_date} au ${leave.end_date}`, type: 'Période', comment: leave.comment||'', recorded_at: leave.created_at, is_period: true });
        }
    });
    if (!agentLeaves.length) { showSnackbar("Aucun congé trouvé pour cet agent sur la période"); return; }
    const agent = agents.find(a => a.code === agentCode);
    const html = `<div class="info-section"><h3>Congés de ${agent.nom} ${agent.prenom}</h3><p>Période: ${period==='all'?'Toute période':startDate.toLocaleDateString()+' au '+endDate.toLocaleDateString()}</p><table class="classement-table"><thead><th>Date(s)</th><th>Type</th><th>Commentaire</th><th>Enregistré le</th></thead><tbody>${agentLeaves.map(l => `<tr><td>${l.date}</td><td><span style="background:${SHIFT_COLORS[l.type]||'#7f8c8d'};color:white;padding:2px 8px;border-radius:3px">${l.type}</span></td><td>${l.comment||'-'}</td><td>${new Date(l.recorded_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div>`;
    openPopup(`Congés de ${agent.code}`, html, `<button class="popup-button blue" onclick="showAgentLeavesSelection()">Autre Agent</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function showGroupLeavesSelection() {
    const groups = ['A','B','C','D','E'];
    const html = `<div class="info-section"><div class="form-group"><label>Groupe</label><select id="groupLeavesSelect">${groups.map(g=>`<option value="${g}">Groupe ${g}</option>`).join('')}</select></div>
    <div class="form-group"><label>Période</label><select id="groupLeavesPeriod"><option value="month">Ce mois</option><option value="last_month">Mois dernier</option><option value="quarter">Ce trimestre</option><option value="year">Cette année</option><option value="all">Toute période</option></select></div>
    <div id="groupLeavesResult"></div></div>`;
    openPopup("Congés par Groupe", html, `<button class="popup-button green" onclick="showGroupLeavesResult()">Voir</button><button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
}
function showGroupLeavesResult() {
    const group = document.getElementById('groupLeavesSelect').value;
    const period = document.getElementById('groupLeavesPeriod').value;
    const today = new Date();
    let startDate, endDate;
    switch(period) {
        case 'month': startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth()+1, 0); break;
        case 'last_month': startDate = new Date(today.getFullYear(), today.getMonth()-1, 1); endDate = new Date(today.getFullYear(), today.getMonth(), 0); break;
        case 'quarter': const q = Math.floor(today.getMonth()/3); startDate = new Date(today.getFullYear(), q*3, 1); endDate = new Date(today.getFullYear(), (q+1)*3, 0); break;
        case 'year': startDate = new Date(today.getFullYear(), 0, 1); endDate = new Date(today.getFullYear(), 11, 31); break;
        default: startDate = new Date(2020,0,1); endDate = new Date(2030,11,31);
    }
    const groupAgents = agents.filter(a => a.groupe === group && a.statut === 'actif');
    const leavesList = [];
    groupAgents.forEach(agent => {
        Object.keys(planningData).forEach(monthKey => {
            if (planningData[monthKey][agent.code]) {
                Object.keys(planningData[monthKey][agent.code]).forEach(dateStr => {
                    const record = planningData[monthKey][agent.code][dateStr];
                    if (['C','M','A'].includes(record.shift)) {
                        const date = new Date(dateStr);
                        if (date >= startDate && date <= endDate) leavesList.push({ agent: `${agent.nom} ${agent.prenom}`, date: dateStr, type: record.shift, comment: record.comment||'' });
                    }
                });
            }
        });
        if (leaves) leaves.filter(l => l.agent_code === agent.code).forEach(leave => {
            const leaveStart = new Date(leave.start_date), leaveEnd = new Date(leave.end_date);
            if ((leaveStart >= startDate && leaveStart <= endDate) || (leaveEnd >= startDate && leaveEnd <= endDate) || (leaveStart <= startDate && leaveEnd >= endDate)) {
                leavesList.push({ agent: `${agent.nom} ${agent.prenom}`, date: `${leave.start_date} au ${leave.end_date}`, type: 'Période', comment: leave.comment||'' });
            }
        });
    });
    let html = `<div class="info-section"><h3>Congés Groupe ${group}</h3>`;
    if (!leavesList.length) html += '<p>Aucun congé trouvé</p>';
    else {
        html += `<table class="classement-table"><thead><th>Agent</th><th>Date(s)</th><th>Type</th><th>Commentaire</th></thead><tbody>${leavesList.map(l => `<tr><td>${l.agent}</td><td>${l.date}</td><td>${SHIFT_LABELS[l.type]||l.type}</td><td>${l.comment||'-'}</td></tr>`).join('')}</tbody></table>`;
    }
    html += `</div>`;
    document.getElementById('groupLeavesResult').innerHTML = html;
}
function exportLeavesReport() {
    let csv = "Rapport des Congés et Absences\n\nDate Export;Nombre total d'absences\n" + new Date().toLocaleDateString() + ";" + countTotalLeaves() + "\n\nAgent;Code;Groupe;Date;Type;Commentaire;Enregistré le\n";
    agents.filter(a => a.statut === 'actif').forEach(agent => {
        const agentLeaves = [];
        Object.keys(planningData).forEach(monthKey => {
            if (planningData[monthKey][agent.code]) {
                Object.keys(planningData[monthKey][agent.code]).forEach(dateStr => {
                    const record = planningData[monthKey][agent.code][dateStr];
                    if (['C','M','A'].includes(record.shift)) agentLeaves.push({ date: dateStr, type: record.shift, comment: record.comment||'', recorded_at: record.recorded_at });
                });
            }
        });
        if (leaves) leaves.filter(l => l.agent_code === agent.code).forEach(leave => {
            agentLeaves.push({ date: `${leave.start_date} au ${leave.end_date}`, type: 'Période', comment: leave.comment||'', recorded_at: leave.created_at });
        });
        agentLeaves.forEach(leave => {
            csv += `${agent.nom} ${agent.prenom};${agent.code};${agent.groupe};${leave.date};${leave.type};"${leave.comment}";${new Date(leave.recorded_at).toLocaleDateString()}\n`;
        });
    });
    downloadCSV(csv, `Rapport_Conges_${new Date().toISOString().split('T')[0]}.csv`);
    showSnackbar("Rapport des congés téléchargé");
}
function countTotalLeaves() {
    let count = 0;
    Object.keys(planningData).forEach(monthKey => {
        Object.keys(planningData[monthKey]).forEach(agentCode => {
            Object.keys(planningData[monthKey][agentCode]).forEach(dateStr => {
                const record = planningData[monthKey][agentCode][dateStr];
                if (['C','M','A'].includes(record.shift)) count++;
            });
        });
    });
    if (leaves) count += leaves.length;
    return count;
}
function showAddLeaveForDate(agentCode, dateStr) {
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><input type="text" value="${agentCode}" readonly></div><div class="form-group"><label>Date</label><input type="text" value="${dateStr}" readonly></div><div class="form-group"><label>Type</label><select id="quickLeaveType"><option value="C">Congé payé</option><option value="M">Maladie</option><option value="A">Autre absence</option></select></div><div class="form-group"><label>Commentaire</label><textarea id="quickLeaveComment" rows="2"></textarea></div></div>`;
    openPopup("Ajouter Congé", html, `<button class="popup-button green" onclick="saveQuickLeave('${agentCode}','${dateStr}')">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function saveQuickLeave(agentCode, dateStr) {
    const type = document.getElementById('quickLeaveType').value;
    const comment = document.getElementById('quickLeaveComment').value;
    const monthKey = dateStr.substring(0,7);
    if (!planningData[monthKey]) planningData[monthKey] = {};
    if (!planningData[monthKey][agentCode]) planningData[monthKey][agentCode] = {};
    planningData[monthKey][agentCode][dateStr] = { shift: type, type: 'absence', comment, recorded_at: new Date().toISOString() };
    saveData();
    showSnackbar("Congé enregistré");
    closePopup();
    showAgentPlanningView();
}
function showDeleteLeaveForm() {
    const allLeaves = [];
    Object.keys(planningData).forEach(mk => {
        Object.keys(planningData[mk]).forEach(ac => {
            Object.keys(planningData[mk][ac]).forEach(d => {
                const record = planningData[mk][ac][d];
                if (record && (record.shift === 'C' || record.shift === 'M' || record.shift === 'A')) {
                    allLeaves.push({ agent: ac, date: d, type: record.shift, comment: record.comment||'', period_id: record.period_id });
                }
            });
        });
    });
    if (!allLeaves.length) { showSnackbar("Aucun congé à supprimer"); return; }
    const html = `<div class="info-section"><div class="form-group"><label>Filtrer par agent</label><select id="deleteFilterAgent" onchange="filterDeleteLeaves()"><option value="all">Tous les agents</option>${agents.filter(a=>a.statut==='actif').map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div><div id="deleteLeavesList">${generateDeleteLeavesList(allLeaves)}</div></div>`;
    openPopup("Supprimer un Congé", html, `<button class="popup-button gray" onclick="closePopup()">Fermer</button>`);
    window.filterDeleteLeaves = function() {
        const filterAgent = document.getElementById('deleteFilterAgent').value;
        const filtered = filterAgent === 'all' ? allLeaves : allLeaves.filter(l => l.agent === filterAgent);
        document.getElementById('deleteLeavesList').innerHTML = generateDeleteLeavesList(filtered);
    };
}
function generateDeleteLeavesList(leavesList) {
    if (!leavesList.length) return '<p>Aucun congé trouvé</p>';
    return `<table class="classement-table"><thead><th>Agent</th><th>Date</th><th>Type</th><th>Commentaire</th><th>Action</th></thead><tbody>${leavesList.map(l => `<tr><td><strong>${l.agent}</strong></td><td>${l.date}</td><td>${SHIFT_LABELS[l.type]}</td><td>${l.comment||'-'}</td><td><button class="action-btn small red" onclick="deleteLeaveItem('${l.agent}','${l.date}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}
function deleteLeaveItem(agentCode, dateStr) {
    if (confirm(`Supprimer le congé de ${agentCode} du ${dateStr} ?`)) {
        const monthKey = dateStr.substring(0,7);
        if (planningData[monthKey]?.[agentCode]?.[dateStr]) {
            delete planningData[monthKey][agentCode][dateStr];
            saveData();
            showSnackbar("Congé supprimé");
            showDeleteLeaveForm();
        }
    }
}
function previewLeave() { showSnackbar("Prévisualisation non disponible"); }

// ==================== CODES PANIQUE ====================
function displayPanicMenu() {
    displaySubMenu("CODES PANIQUE", [
        { text: "➕ Ajouter Code", handler: () => showAddPanicCodeForm() },
        { text: "📋 Liste des Codes", handler: () => showPanicCodesList() },
        { text: "📤 Exporter Codes", handler: () => exportPanicCodes() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddPanicCodeForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="panicAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div><div class="form-group"><label>Code</label><input type="text" id="panicCode" placeholder="Ex: 1234"></div></div>`;
    openPopup("Ajouter Code Panique", html, `<button class="popup-button green" onclick="addPanicCode()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function addPanicCode() {
    const agentCode = document.getElementById('panicAgent').value;
    const code = document.getElementById('panicCode').value;
    if (!code) { showSnackbar("Code requis"); return; }
    const existing = panicCodes.findIndex(p => p.agent_code === agentCode);
    if (existing !== -1) panicCodes[existing] = { agent_code: agentCode, code, created_at: new Date().toISOString() };
    else panicCodes.push({ agent_code: agentCode, code, created_at: new Date().toISOString() });
    saveData();
    showSnackbar("Code ajouté");
    closePopup();
}
function showPanicCodesList() {
    if (!panicCodes.length) { showSnackbar("Aucun code panique"); return; }
    const html = `<div class="info-section"><table class="classement-table"><thead><th>Agent</th><th>Code</th><th>Créé le</th></thead><tbody>${panicCodes.map(p => `<tr><td><strong>${p.agent_code}</strong></td><td>${p.code}</td><td>${new Date(p.created_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div>`;
    openPopup("Codes Panique", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function exportPanicCodes() {
    if (!panicCodes.length) { showSnackbar("Aucun code"); return; }
    let csv = "Agent;Code;Date\n";
    panicCodes.forEach(p => csv += `${p.agent_code};${p.code};${p.created_at}\n`);
    downloadCSV(csv, "codes_panique.csv");
    showSnackbar("Export terminé");
}

// ==================== RADIOS ====================
function displayRadiosMenu() {
    displaySubMenu("GESTION RADIOS", [
        { text: "➕ Ajouter Radio", handler: () => showAddRadioForm() },
        { text: "📋 Liste des Radios", handler: () => showRadiosList() },
        { text: "📲 Attribuer Radio", handler: () => showAssignRadioForm() },
        { text: "🔄 Retour Radio", handler: () => showReturnRadioForm() },
        { text: "📊 Statut Radios", handler: () => showRadiosStatus() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddRadioForm() {
    const html = `<div class="info-section"><div class="form-group"><label>ID Radio</label><input type="text" id="radioId" placeholder="RAD001"></div><div class="form-group"><label>Modèle</label><input type="text" id="radioModel" placeholder="Motorola"></div><div class="form-group"><label>Statut</label><select id="radioStatus"><option>DISPONIBLE</option><option>ATTRIBUEE</option><option>HS</option></select></div></div>`;
    openPopup("Ajouter Radio", html, `<button class="popup-button green" onclick="addRadio()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function addRadio() {
    const id = document.getElementById('radioId').value.toUpperCase();
    if (radios.find(r => r.id === id)) { showSnackbar("ID déjà existant"); return; }
    radios.push({ id, model: document.getElementById('radioModel').value, status: document.getElementById('radioStatus').value, created_at: new Date().toISOString() });
    saveData();
    showSnackbar("Radio ajoutée");
    closePopup();
}
function showRadiosList() {
    if (!radios.length) { showSnackbar("Aucune radio"); return; }
    const html = `<div class="info-section"><table class="classement-table"><thead><th>ID</th><th>Modèle</th><th>Statut</th><th>Attribuée à</th><th>Actions</th></thead><tbody>${radios.map(r => `<tr><td><strong>${r.id}</strong></td><td>${r.model}</td><td><span class="status-badge ${r.status==='DISPONIBLE'?'active':'inactive'}">${r.status}</span></td><td>${r.attributed_to ? (agents.find(a=>a.code===r.attributed_to)?.nom || r.attributed_to) : '-'}</td><td><button class="action-btn small blue" onclick="showAssignRadioForm('${r.id}')">📲</button><button class="action-btn small red" onclick="deleteRadio('${r.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
    openPopup("Liste Radios", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function showAssignRadioForm(radioId) {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><p>Radio: ${radioId}</p><div class="form-group"><label>Agent</label><select id="assignAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div></div>`;
    openPopup("Attribuer Radio", html, `<button class="popup-button green" onclick="assignRadio('${radioId}')">Attribuer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function assignRadio(radioId) {
    const idx = radios.findIndex(r => r.id === radioId);
    if (idx !== -1) {
        radios[idx].status = 'ATTRIBUEE';
        radios[idx].attributed_to = document.getElementById('assignAgent').value;
        radios[idx].attribution_date = new Date().toISOString();
        saveData();
        showSnackbar("Radio attribuée");
        closePopup();
    }
}
function showReturnRadioForm() {
    const attributed = radios.filter(r => r.status === 'ATTRIBUEE');
    if (!attributed.length) { showSnackbar("Aucune radio attribuée"); return; }
    const html = `<div class="info-section"><select id="returnRadio">${attributed.map(r => `<option value="${r.id}">${r.id} - ${r.attributed_to}</option>`).join('')}</select></div>`;
    openPopup("Retour Radio", html, `<button class="popup-button green" onclick="returnRadio()">Retourner</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function returnRadio() {
    const radioId = document.getElementById('returnRadio').value;
    const idx = radios.findIndex(r => r.id === radioId);
    if (idx !== -1) {
        radios[idx].status = 'DISPONIBLE';
        delete radios[idx].attributed_to;
        saveData();
        showSnackbar("Radio retournée");
        closePopup();
    }
}
function showRadiosStatus() {
    const total = radios.length, dispo = radios.filter(r=>r.status==='DISPONIBLE').length, attrib = radios.filter(r=>r.status==='ATTRIBUEE').length, hs = radios.filter(r=>r.status==='HS').length;
    const html = `<div class="info-section"><h3>Statut Radios</h3><p>Total: ${total}</p><p>Disponibles: ${dispo}</p><p>Attribuées: ${attrib}</p><p>HS: ${hs}</p></div>`;
    openPopup("Statut Radios", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function deleteRadio(radioId) {
    if (confirm("Supprimer cette radio ?")) {
        const idx = radios.findIndex(r => r.id === radioId);
        if (idx !== -1) radios.splice(idx, 1);
        saveData();
        showSnackbar("Radio supprimée");
        showRadiosList();
    }
}

// ==================== HABILLEMENT (simplifié) ====================
function displayUniformMenu() {
    displaySubMenu("HABILLEMENT", [
        { text: "➕ Enregistrer Habillement", handler: () => showAddUniformForm() },
        { text: "✏️ Modifier Habillement", handler: () => showEditUniformList() },
        { text: "📋 Rapport Habillement", handler: () => showUniformReport() },
        { text: "📊 Statistiques Tailles", handler: () => showUniformStats() },
        { text: "📅 Échéances", handler: () => showUniformDeadlines() },
        { text: "📤 Exporter Rapport", handler: () => exportUniformReport() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddUniformForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><h3>Enregistrement Habillement</h3><div class="form-group"><label>Agent *</label><select id="uniformAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom} (${a.code})</option>`).join('')}</select></div>
    <div class="form-group"><label>Chemise taille *</label><select id="uniformShirt"><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
    <div class="form-group"><label>Pantalon taille *</label><select id="uniformPants"><option>38</option><option>40</option><option>42</option><option>44</option><option>46</option><option>48</option><option>50</option></select></div>
    <div class="form-group"><label>Veste/Blouson</label><select id="uniformJacket"><option>Non fourni</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select></div>
    <div class="form-group"><label>Casquette</label><select id="uniformCap"><option>Non fournie</option><option>Oui</option></select></div>
    <div class="form-group"><label>Chaussures (pointure)</label><input type="number" id="uniformShoes" step="0.5" placeholder="Ex: 42"></div>
    <div class="form-group"><label>Ceinture</label><select id="uniformBelt"><option>Non fournie</option><option>Oui</option></select></div>
    <div class="form-group"><label>Date fourniture *</label><input type="date" id="uniformDate" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>État chemise</label><select id="uniformShirtCondition"><option>Neuf</option><option>Bon état</option><option>Usé</option><option>Mauvais état</option></select></div>
    <div class="form-group"><label>État pantalon</label><select id="uniformPantsCondition"><option>Neuf</option><option>Bon état</option><option>Usé</option><option>Mauvais état</option></select></div>
    <div class="form-group"><label>Commentaires</label><textarea id="uniformComments" rows="2"></textarea></div></div>`;
    openPopup("Ajouter Habillement", html, `<button class="popup-button green" onclick="addUniform()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function addUniform() {
    const agentCode = document.getElementById('uniformAgent').value;
    const idx = uniforms.findIndex(u => u.agent_code === agentCode);
    const uniform = {
        agent_code: agentCode,
        shirt: document.getElementById('uniformShirt').value,
        pants: document.getElementById('uniformPants').value,
        jacket: document.getElementById('uniformJacket').value !== 'Non fourni' ? document.getElementById('uniformJacket').value : null,
        cap: document.getElementById('uniformCap').value === 'Oui',
        shoes: document.getElementById('uniformShoes').value || null,
        belt: document.getElementById('uniformBelt').value === 'Oui',
        date: document.getElementById('uniformDate').value,
        shirt_condition: document.getElementById('uniformShirtCondition').value,
        pants_condition: document.getElementById('uniformPantsCondition').value,
        comments: document.getElementById('uniformComments').value,
        updated_at: new Date().toISOString()
    };
    if (idx !== -1) uniforms[idx] = uniform;
    else uniforms.push(uniform);
    saveData();
    showSnackbar("Habillement enregistré");
    closePopup();
    showUniformReport();
}
function showEditUniformList() {
    if (!uniforms.length) { showSnackbar("Aucun habillement"); return; }
    const html = `<div class="info-section"><input type="text" id="searchUniform" placeholder="Rechercher agent..." class="form-input" onkeyup="filterUniformList()"><div id="uniformEditList">${generateUniformEditList()}</div></div>`;
    openPopup("Modifier Habillement", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
    window.filterUniformList = function() {
        const search = document.getElementById('searchUniform').value.toLowerCase();
        const filtered = uniforms.filter(u => u.agent_code.toLowerCase().includes(search));
        document.getElementById('uniformEditList').innerHTML = generateUniformEditList(filtered);
    };
}
function generateUniformEditList(list = uniforms) {
    if (!list.length) return '<p>Aucun habillement trouvé</p>';
    return `<table class="classement-table"><thead><th>Agent</th><th>Chemise</th><th>Pantalon</th><th>Veste</th><th>Chaussures</th><th>Date</th><th>Actions</th></thead><tbody>${list.map(u => `<tr><td><strong>${u.agent_code}</strong></td><td>${u.shirt}</td><td>${u.pants}</td><td>${u.jacket||'-'}</td><td>${u.shoes||'-'}</td><td>${u.date}</td><td><button class="action-btn small blue" onclick="editUniform('${u.agent_code}')">✏️</button><button class="action-btn small red" onclick="deleteUniform('${u.agent_code}')">🗑️</button></td></tr>`).join('')}</tbody></table>`;
}
function editUniform(agentCode) {
    const uniform = uniforms.find(u => u.agent_code === agentCode);
    if (!uniform) return;
    const html = `<div class="info-section"><h3>Modifier Habillement - ${agentCode}</h3><div class="form-group"><label>Chemise taille</label><select id="editShirt"><option ${uniform.shirt==='S'?'selected':''}>S</option><option ${uniform.shirt==='M'?'selected':''}>M</option><option ${uniform.shirt==='L'?'selected':''}>L</option><option ${uniform.shirt==='XL'?'selected':''}>XL</option><option ${uniform.shirt==='XXL'?'selected':''}>XXL</option></select></div>
    <div class="form-group"><label>Pantalon taille</label><select id="editPants"><option ${uniform.pants==='38'?'selected':''}>38</option><option ${uniform.pants==='40'?'selected':''}>40</option><option ${uniform.pants==='42'?'selected':''}>42</option><option ${uniform.pants==='44'?'selected':''}>44</option><option ${uniform.pants==='46'?'selected':''}>46</option><option ${uniform.pants==='48'?'selected':''}>48</option><option ${uniform.pants==='50'?'selected':''}>50</option></select></div>
    <div class="form-group"><label>Veste</label><select id="editJacket"><option ${!uniform.jacket?'selected':''}>Non fournie</option><option ${uniform.jacket==='S'?'selected':''}>S</option><option ${uniform.jacket==='M'?'selected':''}>M</option><option ${uniform.jacket==='L'?'selected':''}>L</option><option ${uniform.jacket==='XL'?'selected':''}>XL</option><option ${uniform.jacket==='XXL'?'selected':''}>XXL</option></select></div>
    <div class="form-group"><label>Chaussures</label><input type="number" id="editShoes" value="${uniform.shoes||''}" step="0.5"></div>
    <div class="form-group"><label>Date fourniture</label><input type="date" id="editDate" value="${uniform.date}"></div>
    <div class="form-group"><label>État chemise</label><select id="editShirtCondition"><option ${uniform.shirt_condition==='Neuf'?'selected':''}>Neuf</option><option ${uniform.shirt_condition==='Bon état'?'selected':''}>Bon état</option><option ${uniform.shirt_condition==='Usé'?'selected':''}>Usé</option><option ${uniform.shirt_condition==='Mauvais état'?'selected':''}>Mauvais état</option></select></div>
    <div class="form-group"><label>État pantalon</label><select id="editPantsCondition"><option ${uniform.pants_condition==='Neuf'?'selected':''}>Neuf</option><option ${uniform.pants_condition==='Bon état'?'selected':''}>Bon état</option><option ${uniform.pants_condition==='Usé'?'selected':''}>Usé</option><option ${uniform.pants_condition==='Mauvais état'?'selected':''}>Mauvais état</option></select></div>
    <div class="form-group"><label>Commentaires</label><textarea id="editComments" rows="2">${uniform.comments||''}</textarea></div></div>`;
    openPopup("Modifier Habillement", html, `<button class="popup-button green" onclick="updateUniform('${agentCode}')">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function updateUniform(agentCode) {
    const idx = uniforms.findIndex(u => u.agent_code === agentCode);
    if (idx !== -1) {
        const jacketVal = document.getElementById('editJacket').value;
        uniforms[idx] = {
            ...uniforms[idx],
            shirt: document.getElementById('editShirt').value,
            pants: document.getElementById('editPants').value,
            jacket: jacketVal !== 'Non fournie' ? jacketVal : null,
            shoes: document.getElementById('editShoes').value || null,
            date: document.getElementById('editDate').value,
            shirt_condition: document.getElementById('editShirtCondition').value,
            pants_condition: document.getElementById('editPantsCondition').value,
            comments: document.getElementById('editComments').value,
            updated_at: new Date().toISOString()
        };
        saveData();
        showSnackbar("Habillement modifié");
        closePopup();
        showUniformReport();
    }
}
function deleteUniform(agentCode) {
    if (confirm(`Supprimer l'habillement de ${agentCode} ?`)) {
        const idx = uniforms.findIndex(u => u.agent_code === agentCode);
        if (idx !== -1) uniforms.splice(idx, 1);
        saveData();
        showSnackbar("Habillement supprimé");
        showUniformReport();
    }
}
function showUniformReport() {
    if (!uniforms.length) { showSnackbar("Aucun habillement"); return; }
    const html = `<div class="info-section"><h3>Rapport Habillement</h3><table class="classement-table"><thead><th>Agent</th><th>Chemise</th><th>Pantalon</th><th>Veste</th><th>Chaussures</th><th>Date</th><th>État</th></thead><tbody>${uniforms.map(u => `<tr><td><strong>${u.agent_code}</strong>${u.cap?' 🧢':''}${u.belt?' 🔗':''}${u.jacket?' 🧥':''}${u.shoes?' 👞':''}</td><td>${u.shirt}</td><td>${u.pants}</td><td>${u.jacket||'-'}</td><td>${u.shoes||'-'}</td><td>${u.date}</td><td>${u.shirt_condition||'Neuf'}/${u.pants_condition||'Neuf'}</td></tr>`).join('')}</tbody></table></div>`;
    openPopup("Rapport Habillement", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function showUniformStats() {
    if (!uniforms.length) { showSnackbar("Aucune donnée"); return; }
    const shirtSizes = {}, pantsSizes = {}, jacketSizes = {}, shoesSizes = {};
    uniforms.forEach(u => {
        shirtSizes[u.shirt] = (shirtSizes[u.shirt]||0)+1;
        pantsSizes[u.pants] = (pantsSizes[u.pants]||0)+1;
        if (u.jacket) jacketSizes[u.jacket] = (jacketSizes[u.jacket]||0)+1;
        if (u.shoes) shoesSizes[u.shoes] = (shoesSizes[u.shoes]||0)+1;
    });
    const html = `<div class="info-section"><h3>Statistiques Tailles</h3><h4>Chemises</h4>${Object.entries(shirtSizes).map(([s,c])=>`<p>${s}: ${c}</p>`).join('')}<h4>Pantalons</h4>${Object.entries(pantsSizes).map(([s,c])=>`<p>${s}: ${c}</p>`).join('')}<h4>Vestes</h4>${Object.entries(jacketSizes).map(([s,c])=>`<p>${s}: ${c}</p>`).join('')||'<p>Aucune veste</p>'}<h4>Chaussures</h4>${Object.entries(shoesSizes).map(([s,c])=>`<p>Pointure ${s}: ${c}</p>`).join('')||'<p>Aucune chaussure</p>'}</div>`;
    openPopup("Statistiques Tailles", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function showUniformDeadlines() {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const toRenew = uniforms.filter(u => new Date(u.date) < twoYearsAgo);
    const html = `<div class="info-section"><h3>Échéances Renouvellement (2 ans)</h3>${toRenew.length ? toRenew.map(u => `<div style="padding:10px;background:#e74c3c20;margin:5px 0;border-radius:5px"><strong>${u.agent_code}</strong> - ${u.shirt}/${u.pants} - ${u.date}<br><small>${u.comments||''}</small></div>`).join('') : '<p>Aucune échéance dans les 2 prochaines années</p>'}</div>`;
    openPopup("Échéances", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function exportUniformReport() {
    if (!uniforms.length) { showSnackbar("Aucune donnée"); return; }
    let csv = "Agent;Chemise;Pantalon;Veste;Casquette;Ceinture;Chaussures;Date;ÉtatChemise;ÉtatPantalon;Commentaires\n";
    uniforms.forEach(u => csv += `${u.agent_code};${u.shirt};${u.pants};${u.jacket||''};${u.cap?'Oui':'Non'};${u.belt?'Oui':'Non'};${u.shoes||''};${u.date};${u.shirt_condition||''};${u.pants_condition||''};${u.comments||''}\n`);
    downloadCSV(csv, "rapport_habillement.csv");
    showSnackbar("Rapport exporté");
}

// ==================== AVERTISSEMENTS ====================
function displayWarningsMenu() {
    displaySubMenu("AVERTISSEMENTS", [
        { text: "⚠️ Ajouter Avertissement", handler: () => showAddWarningForm() },
        { text: "📋 Liste Avertissements", handler: () => showWarningsList() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddWarningForm() {
    const activeAgents = agents.filter(a => a.statut === 'actif');
    const html = `<div class="info-section"><div class="form-group"><label>Agent</label><select id="warningAgent">${activeAgents.map(a=>`<option value="${a.code}">${a.nom} ${a.prenom}</option>`).join('')}</select></div>
    <div class="form-group"><label>Type</label><select id="warningType"><option>ORAL</option><option>ECRIT</option><option>MISE_A_PIED</option></select></div>
    <div class="form-group"><label>Date</label><input type="date" id="warningDate" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Description</label><textarea id="warningDesc" rows="3"></textarea></div></div>`;
    openPopup("Ajouter Avertissement", html, `<button class="popup-button green" onclick="addWarning()">Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function addWarning() {
    warnings.push({ id: Date.now(), agent_code: document.getElementById('warningAgent').value, type: document.getElementById('warningType').value, description: document.getElementById('warningDesc').value, date: document.getElementById('warningDate').value, status: 'active', created_at: new Date().toISOString() });
    saveData();
    showSnackbar("Avertissement ajouté");
    closePopup();
}
function showWarningsList() {
    if (!warnings.length) { showSnackbar("Aucun avertissement"); return; }
    const html = `<div class="info-section"><table class="classement-table"><thead><th>Agent</th><th>Type</th><th>Date</th><th>Description</th><th>Actions</th></thead><tbody>${warnings.map(w => `<tr><td><strong>${w.agent_code}</strong></td><td>${w.type}</td><td>${w.date}</td><td>${w.description.substring(0,40)}...</td><td><button class="action-btn small red" onclick="deleteWarning('${w.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
    openPopup("Avertissements", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function deleteWarning(id) {
    if (confirm("Supprimer cet avertissement ?")) {
        const idx = warnings.findIndex(w => w.id == id);
        if (idx !== -1) warnings.splice(idx, 1);
        saveData();
        showSnackbar("Avertissement supprimé");
        showWarningsList();
    }
}

// ==================== JOURS FÉRIÉS ====================
function displayHolidaysMenu() {
    displaySubMenu("JOURS FÉRIÉS", [
        { text: "📋 Liste Jours Fériés", handler: () => showHolidaysList() },
        { text: "➕ Ajouter Jour Férié", handler: () => showAddHolidayForm() },
        { text: "🔄 Générer Annuelle", handler: () => generateYearlyHolidays() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function showAddHolidayForm() {
    const html = `
        <div class="info-section">
            <h3>➕ Ajouter un jour férié</h3>
            <div class="form-group"><label>Date *</label><input type="date" id="newHolidayDate" class="form-input" required></div>
            <div class="form-group"><label>Description *</label><input type="text" id="newHolidayDesc" class="form-input" required placeholder="Ex: Aïd al-Fitr"></div>
            <div class="form-group"><label>Type</label><select id="newHolidayType" class="form-input"><option value="fixe">Fixe</option><option value="religieux">Religieux</option><option value="national">National</option><option value="local">Local</option></select></div>
            <div class="form-group"><label>Répétition annuelle</label><select id="newHolidayRecurring" class="form-input"><option value="false">Non (une seule année)</option><option value="true">Oui (tous les ans)</option></select></div>
            <div class="form-group"><label>Commentaire</label><textarea id="newHolidayComment" class="form-input" rows="2"></textarea></div>
        </div>
    `;
    openPopup("Ajouter jour férié", html, `<button class="popup-button green" onclick="saveHoliday()">💾 Enregistrer</button><button class="popup-button gray" onclick="closePopup()">Annuler</button>`);
}
function saveHoliday() {
    const date = document.getElementById('newHolidayDate').value;
    const description = document.getElementById('newHolidayDesc').value;
    const type = document.getElementById('newHolidayType').value;
    const recurring = document.getElementById('newHolidayRecurring').value === 'true';
    const comment = document.getElementById('newHolidayComment').value;

    if (!date || !description) {
        showSnackbar("Veuillez remplir la date et la description");
        return;
    }

    if (holidays.some(h => h.date === date)) {
        showSnackbar("Cette date est déjà enregistrée comme jour férié");
        return;
    }

    const newHoliday = {
        date,
        description,
        type,
        recurring,
        comment,
        created_at: new Date().toISOString()
    };
    holidays.push(newHoliday);
    saveData();
    showSnackbar("Jour férié ajouté avec succès");
    closePopup();
    showHolidaysList();
}
function showHolidaysList() {
    if (holidays.length === 0) generateYearlyHolidays();
    const sorted = [...holidays].sort((a,b) => new Date(a.date) - new Date(b.date));
    const html = `<div class="info-section"><table class="classement-table"><thead><th>Date</th><th>Jour</th><th>Description</th><th>Type</th><th>Récurrent</th><th>Actions</th></thead><tbody>${sorted.map(h => `
        <tr><td>${h.date}</td><td>${JOURS_FRANCAIS[new Date(h.date).getDay()]}</td><td>${h.description}</td><td>${h.type || 'fixe'}</td><td>${h.recurring ? 'Oui' : 'Non'}</td><td><button class="action-btn small red" onclick="deleteHoliday('${h.date}')">🗑️</button></td></tr>
    `).join('')}</tbody></table></div>`;
    openPopup("Jours fériés", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}
function deleteHoliday(date) {
    if (confirm(`Supprimer le jour férié du ${date} ?`)) {
        const idx = holidays.findIndex(h => h.date === date);
        if (idx !== -1) holidays.splice(idx, 1);
        saveData();
        showSnackbar("Jour férié supprimé");
        showHolidaysList();
    }
}
function generateYearlyHolidays() {
    const year = new Date().getFullYear();
    holidays = [
        { date: `${year}-01-01`, description: 'Nouvel An', type: 'fixe', recurring: true },
        { date: `${year}-01-11`, description: 'Manifeste Indépendance', type: 'fixe', recurring: true },
        { date: `${year}-05-01`, description: 'Fête du Travail', type: 'fixe', recurring: true },
        { date: `${year}-07-30`, description: 'Fête du Trône', type: 'fixe', recurring: true },
        { date: `${year}-08-14`, description: 'Allégeance Oued Eddahab', type: 'fixe', recurring: true },
        { date: `${year}-08-20`, description: 'Révolution Roi et Peuple', type: 'fixe', recurring: true },
        { date: `${year}-08-21`, description: 'Fête de la Jeunesse', type: 'fixe', recurring: true },
        { date: `${year}-11-06`, description: 'Marche Verte', type: 'fixe', recurring: true },
        { date: `${year}-11-18`, description: 'Fête Indépendance', type: 'fixe', recurring: true }
    ];
    saveData();
}

// ==================== EXPORTATIONS ====================
function displayExportMenu() {
    displaySubMenu("EXPORTATIONS", [
        { text: "👥 Agents CSV", handler: () => exportAgentsCSV() },
        { text: "📊 Statistiques CSV", handler: () => exportStatsCSV() },
        { text: "📋 Congés CSV", handler: () => exportLeavesReport() },
        { text: "👔 Habillement CSV", handler: () => exportUniformReport() },
        { text: "📅 Planning Excel", handler: () => showExportPlanningMenu() },
        { text: "💾 Sauvegarde Complète", handler: () => backupAllData() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function exportAgentsCSV() {
    let csv = "Code;Nom;Prénom;Groupe;Téléphone;Poste;Statut\n";
    agents.forEach(a => csv += `${a.code};${a.nom};${a.prenom};${a.groupe};${a.tel||''};${a.poste||''};${a.statut}\n`);
    downloadCSV(csv, "agents.csv");
    showSnackbar("Export agents terminé");
}
function exportStatsCSV() {
    const today = new Date();
    const month = today.getMonth()+1, year = today.getFullYear();
    let csv = "Agent;Code;Groupe;Travaillés;Fériés;Total;Taux;Congés\n";
    agents.filter(a => a.statut === 'actif').forEach(a => {
        const stats = calculateWorkedDays(a.code, month, year);
        csv += `${a.nom} ${a.prenom};${a.code};${a.groupe};${stats.workedDays};${stats.holidayWorkedDays};${stats.totalDays};${Math.round(stats.workedDays/stats.totalDays*100)}%;${stats.leaveDays}\n`;
    });
    downloadCSV(csv, `statistiques_${getMonthName(month)}_${year}.csv`);
    showSnackbar("Export statistiques terminé");
}
function backupAllData() {
    const backup = { agents, planningData, holidays, panicCodes, radios, uniforms, warnings, leaves, date: new Date().toISOString() };
    downloadCSV(JSON.stringify(backup, null, 2), "sga_backup.json");
    showSnackbar("Sauvegarde effectuée");
}
function downloadCSV(content, filename) {
    const blob = new Blob(["\uFEFF"+content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==================== CONFIGURATION AVEC MOT DE PASSE ====================
function displayConfigMenu() {
    displaySubMenu("CONFIGURATION", [
        { text: "🗑️ Effacer Données", handler: () => { if(checkPassword()) clearAllData(); else showSnackbar("Mot de passe incorrect"); } },
        { text: "🔄 Réinitialiser Test", handler: () => { if(checkPassword()) resetTestData(); else showSnackbar("Mot de passe incorrect"); } },
        { text: "🔐 Changer mot de passe", handler: () => changePassword() },
        { text: "ℹ️ À propos", handler: () => showAbout() },
        { text: "↩️ Retour", handler: () => displayMainMenu(), className: "back-button" }
    ]);
}
function changePassword() {
    if (!checkPassword()) { showSnackbar("Mot de passe actuel incorrect"); return; }
    const newPwd = prompt("Nouveau mot de passe :");
    if (newPwd && newPwd.trim()) {
        ADMIN_PASSWORD = newPwd;
        localStorage.setItem('sga_password', newPwd);
        showSnackbar("Mot de passe modifié");
    }
}
function clearAllData() {
    if (confirm("Effacer toutes les données ?")) {
        localStorage.clear();
        agents = []; planningData = {}; holidays = []; panicCodes = []; radios = []; uniforms = []; warnings = []; leaves = [];
        initializeTestData();
        showSnackbar("Données réinitialisées");
        displayMainMenu();
        closePopup();
    }
}
function resetTestData() {
    if (confirm("Réinitialiser avec les données de test ?")) {
        initializeTestData();
        showSnackbar("Données de test chargées");
        displayMainMenu();
        closePopup();
    }
}
function showAbout() {
    const html = `<div class="info-section" style="text-align:center"><h3>SGA - CleanCo</h3><p>Système de Gestion des Agents</p><p>Version 5.1</p><p>© 2025</p><hr><p>📊 Total jours = travaillés (shifts 1,2,3) + fériés travaillés<br>🎉 Jours fériés comptés si l'agent travaille<br>👔 Habillement complet<br>📅 Congés par période avec option dimanches<br>📈 Évolution mensuelle et classement par groupe<br>📁 Import depuis data.js (corrigé)<br>🔄 Logique Python des cycles de shift<br>📊 Export planning en Excel</p></div>`;
    openPopup("À propos", html, '<button class="popup-button gray" onclick="closePopup()">Fermer</button>');
}

console.log("✅ SGA chargé - Version 5.1 avec import data.js corrigé et calcul des jours travaillés (travaillés + fériés)");