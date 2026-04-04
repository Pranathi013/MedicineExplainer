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
                        ${med.when_to_take ? `<div class="chip"><span>☀️</span> ${med.when_to_take}</div>` : ''}
                    </div>
                    <div class="medicine-expand" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                        ℹ️ More Info ▾
                    </div>
                    <div class="medicine-details">
                        <p><strong>Generic:</strong> ${med.generic_name || 'N/A'}</p>
                        <p><strong>Purpose:</strong> ${med.purpose || 'N/A'}</p>
                    </div>
                </div>
            `;
            medContainer.insertAdjacentHTML('beforeend', html);
        });

        // Render Instructions
        const instContainer = document.getElementById('instructions-container');
        instContainer.innerHTML = '';
        (data.instructions || []).forEach((inst, index) => {
            const delay = index * 0.1;
            instContainer.insertAdjacentHTML('beforeend', `
                <li class="step-item" style="animation-delay: ${delay}s">${inst}</li>
            `);
        });

        // Render Tips
        const tipsContainer = document.getElementById('tips-container');
        tipsContainer.innerHTML = '';
        (data.diet_tips || []).forEach(tip => {
            tipsContainer.insertAdjacentHTML('beforeend', `
                <div class="tip-item ${tip.type || 'info'}">
                    <div class="tip-icon">${tip.icon || '📌'}</div>
                    <div>
                        <strong>${tip.type === 'info' ? 'DIET TIP' : tip.type === 'warning' ? 'CAUTION' : 'NOTE'}</strong>
                        <p>${tip.tip}</p>
                    </div>
                </div>
            `);
        });
        (data.warnings || []).forEach(warn => {
             tipsContainer.insertAdjacentHTML('beforeend', `
                <div class="tip-item danger">
                    <div class="tip-icon">⚠️</div>
                    <div>
                        <strong>WARNING</strong>
                        <p>${warn.warning}</p>
                    </div>
                </div>
            `);
        });

        // Render Set Reminders
        const remContainer = document.getElementById('set-reminders-container');
        remContainer.innerHTML = '';
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

            items.forEach(item => {
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
                        <button class="btn btn-outline" onclick='app.viewHistoryItem(${JSON.stringify(item.result_json).replace(/'/g, "\\'")})'>
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
