const API_BASE = '/api';

const app = {
    currentImageFile: null,

    init() {
        // Initially show hero page
        this.showSection('hero');
        // Pre-fetch history and reminders silently
        this.loadHistory();
        this.loadReminders();
    },

    showSection(sectionId) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            if(link.dataset.target === sectionId || (sectionId === 'input-section' && link.dataset.target === 'hero')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Hide all, show target
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

        // Close mobile nav if open
        const navLinks = document.querySelector('.nav-links');
        if(navLinks.classList.contains('active')) navLinks.classList.remove('active');
        
        window.scrollTo(0, 0);

        if(sectionId === 'history-section') this.loadHistory();
        if(sectionId === 'reminders-section') this.loadReminders();
        if(sectionId === 'emergency-section') this.loadEmergency();
    },

    switchTab(tab) {
        document.getElementById('tab-type').classList.toggle('active', tab === 'type');
        document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
        document.getElementById('type-tab').style.display = tab === 'type' ? 'block' : 'none';
        document.getElementById('upload-tab').style.display = tab === 'upload' ? 'block' : 'none';
        document.getElementById('analyze-btn').innerHTML = tab === 'upload' && this.currentImageFile 
            ? '<span class="icon">🔍</span> Analyze Uploaded Image' 
            : '<span class="icon">🔍</span> Analyze Prescription';
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.currentImageFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('image-preview').src = e.target.result;
                document.getElementById('image-preview').style.display = 'block';
                document.querySelector('.upload-content').style.display = 'none';
                document.getElementById('analyze-btn').innerHTML = '<span class="icon">🔍</span> Analyze Uploaded Image';
            }
            reader.readAsDataURL(file);
        }
    },

    async analyzePrescription() {
        const isUploadTab = document.getElementById('tab-upload').classList.contains('active');
        
        // UI Loading State
        document.getElementById('analyze-loader').style.display = 'flex';
        document.getElementById('analyze-btn').style.display = 'none';
        
        try {
            let data;
            if (isUploadTab) {
                if (!this.currentImageFile) {
                    alert('Please select an image first.');
                    document.getElementById('analyze-loader').style.display = 'none';
                    document.getElementById('analyze-btn').style.display = 'inline-flex';
                    return;
                }
                const formData = new FormData();
                formData.append('file', this.currentImageFile);
                const response = await fetch(`${API_BASE}/analyze-image`, {
                    method: 'POST',
                    body: formData
                });
                data = await response.json();
                if (!response.ok) throw new Error(data.detail || data.error || 'Server error');
            } else {
                const text = document.getElementById('prescription-text').value;
                if (!text.trim()) {
                    alert('Please enter prescription text.');
                    document.getElementById('analyze-loader').style.display = 'none';
                    document.getElementById('analyze-btn').style.display = 'inline-flex';
                    return;
                }
                const response = await fetch(`${API_BASE}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prescription_text: text })
                });
                data = await response.json();
                if (!response.ok) throw new Error(data.detail || data.error || 'Server error');
            }

            if(data.error) throw new Error(data.error);

            if (!data.medicines || data.medicines.length === 0) {
                throw new Error('No medicines found in analysis. Please check your input.');
            }

            this.renderResults(data);
            this.showSection('results-section');
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Failed to analyze prescription: ' + error.message);
        } finally {
            document.getElementById('analyze-loader').style.display = 'none';
            document.getElementById('analyze-btn').style.display = 'inline-flex';
        }
    },

    renderResults(data) {
        // Render Medicines
        const medContainer = document.getElementById('medicines-container');
        medContainer.innerHTML = '';
        (data.medicines || []).forEach(med => {
            const html = `
                <div class="medicine-item">
                    <div class="medicine-header">
                        <div>
                            <div class="medicine-name">${med.name}</div>
                            <div class="badge-row">
                                <span class="badge">${med.dosage || ''}</span>
                                <span class="badge">${med.frequency || ''}</span>
                                <span class="badge">${med.duration || ''}</span>
                                ${med.drug_class ? `<span class="badge text-mint">${med.drug_class}</span>` : ''}
                            </div>
                        </div>
                        ${(med.timing || med.when_to_take) ? `<div class="chip"><span>☀️</span> ${med.timing || med.when_to_take}</div>` : ''}
                    </div>
                    <div class="medicine-expand" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                        ℹ️ More Info ▾
                    </div>
                    <div class="medicine-details" style="display:none;">
                        <p><strong>Generic:</strong> ${med.generic_name || 'N/A'}</p>
                        <p><strong>Purpose:</strong> ${med.purpose || 'N/A'}</p>
                        <p><strong>How to take:</strong> ${med.how_to_take || 'N/A'}</p>
                        <p><strong>Missed dose:</strong> ${med.missed_dose || 'N/A'}</p>
                    </div>
                </div>
            `;
            medContainer.insertAdjacentHTML('beforeend', html);
        });

        // Render Instructions
        const instContainer = document.getElementById('instructions-container');
        instContainer.innerHTML = '';
        
        let copyButton = document.querySelector('#card-instructions .btn-copy');
        if (!copyButton) {
        	// User wanted a copy button top right
        	const instCard = document.getElementById('card-instructions');
        	if (instCard) {
        		// Remove old copy button if any
        		let oldBtn = instCard.querySelector('.flex-between .btn-micro');
        		if(oldBtn) oldBtn.remove();
        		
        		let newBtn = document.createElement('button');
        		newBtn.className = 'btn-micro outline btn-copy';
        		newBtn.innerHTML = '📋 Copy all';
        		newBtn.onclick = () => app.copyInstructions();
        		instCard.appendChild(newBtn);
        	}
        }

        if (data.overall_summary) {
            instContainer.insertAdjacentHTML('beforeend', `
                <div class="inst-summary-strip">
                    <strong>Summary</strong><br>
                    <span class="text-sm">${data.overall_summary}</span>
                </div>
            `);
        }

        (data.instructions || []).forEach((inst, index) => {
            const delay = index * 0.1;
            
            // Heuristic coloring based on medicine names in instruction
            let colorAccent = 'gray'; // general
            let bgTint = '#16181f';
            let pillColor = 'gray';
            let pillBg = '#16181f';
            let medicineName = '';

            const lowerInst = inst.toLowerCase();
            if (lowerInst.includes('amoxicillin')) {
            	colorAccent = 'var(--accent-blue)'; bgTint = '#0d1a2e'; pillColor = '#7ec8f7'; pillBg = '#0c2a4a'; medicineName = 'Amoxicillin';
            } else if (lowerInst.includes('paracetamol')) {
            	colorAccent = 'var(--accent-amber)'; bgTint = '#2a1a05'; pillColor = '#fad289'; pillBg = '#332007'; medicineName = 'Paracetamol';
            } else if (lowerInst.includes('omeprazole')) {
            	colorAccent = 'var(--accent-teal)'; bgTint = '#0a2118'; pillColor = '#5ee8bd'; pillBg = '#0b2b1f'; medicineName = 'Omeprazole';
            }

			// extract parts if it has colon
			let content = inst;
			let title = '';
			if (inst.includes(':')) {
				const parts = inst.split(':', 2);
				title = parts[0].trim();
				content = parts[1].trim();
			} else if (medicineName) {
				title = medicineName;
			}

            let html = `
                <li class="step-item" style="animation-delay: ${delay}s; border-left-color: ${colorAccent}; background: ${bgTint}; --step-bg: ${colorAccent};">
                    <style>
                        .step-item:nth-child(${index + (data.overall_summary ? 2 : 1)})::before { background: ${colorAccent} !important; }
                    </style>
                    <div class="step-item-content inst-text">
                        ${title ? `<div class="inst-med-name">${title}</div>` : ''}
                        <div>${content}</div>
                    </div>
                </li>
            `;
            instContainer.insertAdjacentHTML('beforeend', html);
        });
        
        if (data.combination_explanation) {
            instContainer.insertAdjacentHTML('beforeend', `
                <div class="mt-4">
                    <div class="accordion-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                        <strong>Why this combination?</strong>
                        <span style="font-size: 0.8rem;">▾</span>
                    </div>
                    <div class="accordion-body inst-text">
                        <span class="text-sm">${data.combination_explanation}</span>
                    </div>
                </div>
            `);
        }

        // Render Side Effects & Actions
        const seContainer = document.getElementById('side-effects-container');
        seContainer.innerHTML = '';
        
        let hasSideEffects = false;
        (data.medicines || []).forEach(med => {
            if (med.side_effects_action && Array.isArray(med.side_effects_action) && med.side_effects_action.length > 0) {
                hasSideEffects = true;
                
                let medHTML = `<div class="mb-3">
                    <h4 class="text-mint mb-2" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; font-size: 1rem;">💊 ${med.name}</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">`;
                
                med.side_effects_action.forEach(se => {
                    let color = '#00E5A0'; // green
                    if (se.severity === 'moderate') { color = '#F5A623'; }
                    if (se.severity === 'severe') { color = '#FF4757'; }
                    
                    let buttonsHTML = '';
                    if (se.stop_medicine) {
                        buttonsHTML += `<div style="background: rgba(255,71,87,0.1); border: 1px solid #FF4757; color: #FF4757; padding: 4px 8px; border-radius: 4px; display: inline-block; font-weight: 600; font-size: 0.75rem; margin-right: 0.5rem; margin-top: 0.5rem;">🛑 STOP MEDICINE</div>`;
                    }
                    if (se.emergency) {
                         buttonsHTML += `<button class="btn btn-primary mt-2" style="background:#FF4757; border-color:#FF4757; padding: 6px 12px; font-size: 0.8rem; margin-right: 0.5rem;">🚑 Call Ambulance</button>`;
                    } else if (se.doctor_required) {
                         buttonsHTML += `<button class="btn btn-primary mt-2" style="background:#F5A623; border-color:#F5A623; color:#111; padding: 6px 12px; font-size: 0.8rem; margin-right: 0.5rem;">👨‍⚕️ Contact Doctor</button>`;
                    }

                    medHTML += `
                        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; padding: 1rem; border-radius: 6px;">
                            <div class="flex-between align-start mb-2">
                                <strong>${se.effect}</strong>
                                <span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: ${color}20; color: ${color}; text-transform: uppercase;">${se.severity}</span>
                            </div>
                            <p class="text-sm text-muted mb-2">${se.description}</p>
                            <p class="text-sm"><strong>Action:</strong> ${se.action}</p>
                            ${buttonsHTML ? `<div class="mt-2">${buttonsHTML}</div>` : ''}
                        </div>
                    `;
                });
                
                medHTML += `</div></div>`;
                seContainer.insertAdjacentHTML('beforeend', medHTML);
            }
        });
        if (!hasSideEffects) {
             seContainer.innerHTML = '<p class="text-muted text-sm" style="font-style: italic;">No specific side effects data provided for these medicines.</p>';
        }

        // Render Tips
        const tipsContainer = document.getElementById('tips-container');
        tipsContainer.innerHTML = '';
        
        (data.diet_tips || []).forEach(tip => {
            let icon = '📌';
            let classType = 'info';
            if (tip.type === 'caution' || tip.type === 'avoid' || tip.type === 'warning') {
                icon = '⚠️';
                classType = 'danger';
            } else if (tip.type === 'tip') {
                icon = '💡';
                classType = 'info';
            }
            let title = (tip.title || tip.type || 'NOTE').toUpperCase();
            
            tipsContainer.insertAdjacentHTML('beforeend', `
                <div class="tip-item ${classType}">
                    <div class="tip-icon">${icon}</div>
                    <div>
                        <strong>${title}</strong>
                        <p>${tip.detail || tip.tip || ''}</p>
                    </div>
                </div>
            `);
        });

        (data.food_drug_interactions || []).forEach(interaction => {
             tipsContainer.insertAdjacentHTML('beforeend', `
                <div class="tip-item danger">
                    <div class="tip-icon">⛔</div>
                    <div>
                        <strong>AVOID (FOOD DRUG INTERACTION) - ${interaction.medicine}</strong>
                        <p>${interaction.avoid}</p>
                    </div>
                </div>
            `);
        });

        (data.medicines || []).forEach(med => {
            if (med.warnings && Array.isArray(med.warnings)) {
                 med.warnings.forEach(warn => {
                     let text = warn.warning || warn;
                     tipsContainer.insertAdjacentHTML('beforeend', `
                        <div class="tip-item danger">
                            <div class="tip-icon">⚠️</div>
                            <div>
                                <strong>WARNING - ${med.name}</strong>
                                <p>${text}</p>
                            </div>
                        </div>
                    `);
                 });
            }
        });

        if (data.warnings && Array.isArray(data.warnings)) {
            data.warnings.forEach(warn => {
                 tipsContainer.insertAdjacentHTML('beforeend', `
                    <div class="tip-item danger">
                        <div class="tip-icon">⚠️</div>
                        <div>
                            <strong>WARNING</strong>
                            <p>${warn.warning || warn}</p>
                        </div>
                    </div>
                `);
            });
        }

        // Render Set Reminders
        const remContainer = document.getElementById('set-reminders-container');
        remContainer.innerHTML = '';
        
        if (data.reminders && Array.isArray(data.reminders)) {
            data.reminders.forEach(rem => {
                (rem.times || []).forEach(time => {
                    let matchingMed = (data.medicines || []).find(m => m.name === rem.medicine);
                    let freq = matchingMed ? matchingMed.frequency : 'Daily';
                    let duration = matchingMed ? parseInt(matchingMed.duration) || 0 : 0;
                    
                    remContainer.insertAdjacentHTML('beforeend', `
                        <div class="dose-row" data-med="${rem.medicine}" data-time="${time}" data-freq="${freq}" data-days="${duration}">
                            <div class="dose-info">
                                <div class="dose-name">${rem.medicine}</div>
                                <div class="dose-time">${time} <span style="font-size: 0.8rem; font-weight:normal; margin-left: 5px;">(${rem.note || freq})</span></div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" checked class="reminder-toggle">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `);
                });
            });
        } else {
            (data.medicines || []).forEach(med => {
                (med.frequency_times || []).forEach(time => {
                    remContainer.insertAdjacentHTML('beforeend', `
                        <div class="dose-row" data-med="${med.name}" data-time="${time}" data-freq="${med.frequency}" data-days="${parseInt(med.duration)||0}">
                            <div class="dose-info">
                                <div class="dose-name">${med.name}</div>
                                <div class="dose-time">${time}</div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" checked class="reminder-toggle">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `);
                });
            });
        }
        
        const suggBox = document.getElementById('suggestions-box');
        if (suggBox) {
            if (remContainer.innerHTML.trim() !== '') {
                suggBox.style.display = 'block';
            } else {
                suggBox.style.display = 'none';
            }
        }
    },

    async saveReminders() {
        const rows = document.querySelectorAll('#set-reminders-container .dose-row');
        let savedCount = 0;
        
        for(let row of rows) {
            const isChecked = row.querySelector('.reminder-toggle').checked;
            if(isChecked) {
                const payload = {
                    medicine_name: row.dataset.med,
                    dose_time: row.dataset.time,
                    frequency: row.dataset.freq,
                    days: parseInt(row.dataset.days)
                };
                try {
                    await fetch(`${API_BASE}/reminders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    savedCount++;
                } catch(e) {
                    console.error('Failed to save reminder:', e);
                }
            }
        }
        
        this.showToast(`Saved ${savedCount} reminders!`);
        
        const suggBox = document.getElementById('suggestions-box');
        if (suggBox) suggBox.style.display = 'none';
        document.getElementById('set-reminders-container').innerHTML = '';

        this.loadReminders(); // Refresh background list
        this.showSection('reminders-section');
    },

    async loadReminders() {
        try {
            const res = await fetch(`${API_BASE}/reminders`);
            const rems = await res.json();
            const container = document.getElementById('saved-reminders-list');
            container.innerHTML = '';
            
            if(rems.length === 0) {
                container.innerHTML = `
                    <div class="upload-zone" style="cursor:default">
                        <div class="upload-icon">🕒</div>
                        <h3 class="mt-2">No active reminders</h3>
                        <p class="text-sm text-muted mt-2">Scan a prescription to setup your schedule.</p>
                    </div>
                `;
                return;
            }

            rems.forEach(rem => {
                container.insertAdjacentHTML('beforeend', `
                    <div class="dose-row" id="rem-${rem.id}">
                        <div class="icon" style="background: rgba(0,229,160,0.1); width: 40px; height: 40px; display:flex; align-items:center; justify-content:center; border-radius: 8px; font-size:1.2rem; margin-right: 1rem;">💊</div>
                        <div class="dose-info">
                            <div class="dose-name">${rem.medicine_name}</div>
                            <div class="badge-row mt-1">
                                <span class="badge text-mint">${rem.frequency}</span>
                            </div>
                        </div>
                        <div class="flex align-center gap-4">
                            <div class="dose-time" style="font-size: 1.5rem; font-weight:700; color:var(--text-main);">${rem.dose_time}</div>
                            <button class="btn-micro outline" onclick="app.deleteReminder(${rem.id})">🗑️</button>
                        </div>
                    </div>
                `);
            });
        } catch(e) {
            console.error('Failed loading reminders:', e);
        }
    },

    async deleteReminder(id) {
        if(!confirm('Delete this reminder?')) return;
        try {
            await fetch(`${API_BASE}/reminders/${id}`, { method: 'DELETE' });
            document.getElementById(`rem-${id}`).remove();
            this.showToast('Reminder deleted');
        } catch(e) {
            console.error('Delete error', e);
        }
    },

    async checkSymptoms() {
        const symptoms = document.getElementById('symptom-input').value;
        const meds = document.getElementById('symptom-medicines').value.split(',').map(m=>m.trim());
        
        if(!symptoms) {
            alert('Please describe your symptoms.');
            return;
        }

        document.getElementById('symptom-loader').style.display = 'flex';
        document.getElementById('severity-result').style.display = 'none';

        try {
            const res = await fetch(`${API_BASE}/symptom-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptoms, current_medicines: meds })
            });
            const data = await res.json();
            
            if(data.error) throw new Error(data.error);

            document.getElementById('sev-emoji').innerText = data.emoji || '⚠️';
            document.getElementById('sev-level').innerText = (data.severity || '').toUpperCase();
            document.getElementById('sev-level').style.color = data.color || '#fff';
            document.getElementById('sev-guidance').innerText = data.guidance || '';
            
            const bar = document.getElementById('sev-bar');
            bar.style.backgroundColor = data.color;
            bar.style.width = '0%';
            
            document.getElementById('severity-result').style.display = 'block';
            document.getElementById('severity-result').style.borderColor = data.color;
            document.getElementById('severity-result').style.boxShadow = `0 0 30px ${data.color}20`;
            
            setTimeout(() => {
                let w = '33%';
                if(data.severity === 'moderate') w = '66%';
                if(data.severity === 'severe') w = '100%';
                bar.style.width = w;
            }, 100);

        } catch(e) {
            alert('Failed to check symptoms: ' + e.message);
        } finally {
            document.getElementById('symptom-loader').style.display = 'none';
        }
    },

    async loadHistory() {
        try {
            const res = await fetch(`${API_BASE}/history`);
            const items = await res.json();
            const container = document.getElementById('history-list');
            container.innerHTML = '';
            
            if(items.length === 0) {
                container.innerHTML = `
                    <div class="upload-zone" style="cursor:default">
                        <div class="upload-icon">🚫</div>
                        <h3 class="mt-2">No prescriptions analyzed yet</h3>
                        <p class="text-sm text-muted mt-2">When you scan your medication labels, they will appear here.</p>
                    </div>
                `;
                return;
            }

            window._rxHistory = items;
            
            items.forEach((item, index) => {
                const date = new Date(item.created_at).toLocaleString();
                let title = 'Prescription Scan';
                let medCount = 0;
                
                if(item.result_json && item.result_json.medicines) {
                    title = item.result_json.medicines[0]?.name || title;
                    medCount = item.result_json.medicines.length;
                }
                
                container.insertAdjacentHTML('beforeend', `
                    <div class="history-item">
                        <div>
                            <div class="hist-date">${date}</div>
                            <div class="hist-main">${title}</div>
                            <div class="badge mt-2">${medCount} MEDICINE${medCount !== 1?'S':''}</div>
                        </div>
                        <button class="btn btn-outline" onclick="app.viewHistoryItem(window._rxHistory[${index}].result_json)">
                            View Results →
                        </button>
                    </div>
                `);
            });
        } catch(e) {
            console.error('Failed loading history', e);
        }
    },

    viewHistoryItem(jsonData) {
        if(!jsonData || !jsonData.medicines) {
            alert("This record doesn't contain valid analysis data.");
            return;
        }
        this.renderResults(jsonData);
        this.showSection('results-section');
    },

    copyInstructions() {
        const items = document.querySelectorAll('#instructions-container .step-item');
        let text = "RxClear Prescriptions Instructions:\n\n";
        items.forEach((item, index) => {
            text += `${index + 1}. ${item.innerText}\n`;
        });
        
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Instructions copied to clipboard!');
        });
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    async loadEmergency() {
        const container = document.getElementById('emergency-content');
        if(!container) return;
        
        try {
            const res = await fetch(`${API_BASE}/emergency`);
            const data = await res.json();
            const emergencyData = data.emergency_support;
            
            let html = `
                <style>
                    @keyframes emergency-pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(255, 71, 87, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
                    }
                    .btn-emergency-pulse {
                        animation: emergency-pulse 1.5s infinite ease-out;
                        background: #FF4757 !important;
                        border-color: #FF4757 !important;
                        color: white !important;
                        font-size: 1.2rem !important;
                        padding: 1rem !important;
                        text-decoration: none;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .emb {
                        display: block;
                        text-align: center;
                        background: rgba(255, 255, 255, 0.05);
                        padding: 1.5rem;
                        border-radius: 12px;
                        border: 1px solid rgba(255,255,255,0.1);
                        transition: all 0.2s;
                        color: white;
                        text-decoration: none;
                    }
                    .emb:hover {
                        background: rgba(255, 255, 255, 0.1);
                    }
                </style>
                <div class="alert-box danger" style="border: none;">
                    <strong>⚠️ GENERAL INSTRUCTION</strong>
                    <p class="mt-2 text-sm">${emergencyData.general_instruction}</p>
                </div>
                
                <h3 class="mt-2 mb-2">Ambulance Services</h3>
                <p class="text-sm text-muted">${emergencyData.ambulance.description}</p>
                <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
            `;
            
            emergencyData.ambulance.contact_numbers.forEach(num => {
                html += `
                    <a href="tel:${num}" class="emb">
                        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem; color:#FF4757; font-weight: bold;">📞 ${num}</span>
                        <span class="text-sm">Tap to call</span>
                    </a>
                `;
            });
            
            html += `</div>
                <div class="mt-4 mb-2">
                    <a href="tel:${emergencyData.ambulance.contact_numbers[0]}" class="btn btn-primary btn-full btn-emergency-pulse">
                        🚑 CALL AMBULANCE IMMEDIATELY
                    </a>
                    <p class="text-center text-sm text-muted mt-2">Estimated Response: ${emergencyData.ambulance.estimated_response}</p>
                </div>
                
                <h3 class="mt-4 mb-2">Nearby Hospitals (Simulation)</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
            `;
            
            emergencyData.hospitals.forEach(hosp => {
                html += `
                    <div style="background: rgba(0, 229, 160, 0.05); border-left: 3px solid #00E5A0; padding: 1.2rem; border-radius: 8px;">
                        <div class="flex-between align-center mb-2">
                            <strong>🏥 ${hosp.name}</strong>
                            <span class="badge" style="background: rgba(0, 229, 160, 0.2); color: #00E5A0;">${hosp.distance}</span>
                        </div>
                        <p class="text-sm text-muted">${hosp.type}</p>
                    </div>
                `;
            });
            
            html += `</div>`;
            
            // Fetch Custom Contacts
            let customContacts = [];
            try {
                const conRes = await fetch(`${API_BASE}/emergency/contacts`);
                if(conRes.ok) customContacts = await conRes.json();
            } catch(ce) { console.error('Failed to load custom contacts:', ce); }
            
            html += `<h3 class="mt-4 mb-2">My Custom Contacts</h3>
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 1rem;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <input type="text" id="new-contact-name" placeholder="Name (e.g. Nurse Jane)" style="flex: 1; min-width: 150px;" class="input-field">
                        <input type="tel" id="new-contact-phone" placeholder="Phone Number" style="flex: 1; min-width: 150px;" class="input-field">
                        <button class="btn btn-outline" onclick="app.saveEmergencyContact()">Add</button>
                    </div>
                </div>
                <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
            `;
            
            if (customContacts.length === 0) {
                 html += `<p class="text-sm text-muted" style="grid-column: 1 / -1; display:flex; justify-content:center;">No custom contacts added yet.</p>`;
            } else {
                customContacts.forEach(contact => {
                    html += `
                        <div style="background: rgba(0,229,160,0.05); padding: 1rem; border-radius: 8px; position:relative; border-left: 3px solid #00E5A0;">
                            <button onclick="app.deleteEmergencyContact(${contact.id})" style="position:absolute; top:5px; right:5px; background:none; border:none; color:#FF4757; font-size:1rem; cursor:pointer;" title="Delete">🗑️</button>
                            <div style="font-weight: 600; font-size: 1.1rem; color: #FFF; margin-bottom: 0.5rem;">${contact.name}</div>
                            <a href="tel:${contact.phone}" style="display:block; text-decoration:none; color: #00E5A0; font-weight: bold; background: rgba(0,229,160,0.1); padding: 6px; border-radius: 4px; text-align: center;">📞 ${contact.phone}</a>
                        </div>
                    `;
                });
            }
            html += `</div>`;
            
            container.innerHTML = html;
        } catch(e) {
            console.error('Failed to load emergency data:', e);
            container.innerHTML = `<div class="alert-box danger">Failed to load emergency services. Please check connection or dial 911 directly.</div>`;
        }
    },
    
    async saveEmergencyContact() {
        const nameInput = document.getElementById('new-contact-name');
        const phoneInput = document.getElementById('new-contact-phone');
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        if (!name || !phone) {
            this.showToast('Please enter both name and phone number');
            return;
        }
        
        try {
            await fetch(`${API_BASE}/emergency/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone })
            });
            this.showToast('Contact added!');
            this.loadEmergency(); // Refresh the list
        } catch(e) {
            console.error('Error adding contact:', e);
            this.showToast('Failed to add contact');
        }
    },
    
    async deleteEmergencyContact(id) {
        if (!confirm('Delete this contact?')) return;
        
        try {
            await fetch(`${API_BASE}/emergency/contacts/${id}`, {
                method: 'DELETE'
            });
            this.showToast('Contact deleted!');
            this.loadEmergency(); // Refresh the list
        } catch(e) {
            console.error('Error deleting contact:', e);
            this.showToast('Failed to delete contact');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    // Character counter for textarea
    const ta = document.getElementById('prescription-text');
    const counter = document.getElementById('char-counter');
    if(ta) {
        ta.addEventListener('input', () => {
            counter.innerText = ta.value.length;
        });
    }
});
