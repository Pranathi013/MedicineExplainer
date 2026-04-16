/* tracking.js — Patient Tracking System (Phases 1, 2, 3) */

const tracking = {
    currentSessionId: null,
    currentSession: null,

    /* ─────────────────────────────
       INIT
    ───────────────────────────── */
    init() {
        // Restore session from localStorage
        const saved = localStorage.getItem('rxclear_tracking_session');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                this.currentSessionId = s.session_id;
                this.currentSession   = s;
            } catch {}
        }
        this.updateTrackingBadge();
    },

    saveSession(data) {
        this.currentSessionId = data.session_id;
        this.currentSession   = data;
        localStorage.setItem('rxclear_tracking_session', JSON.stringify(data));
    },

    clearSession() {
        this.currentSessionId = null;
        this.currentSession   = null;
        localStorage.removeItem('rxclear_tracking_session');
    },

    updateTrackingBadge() {
        const badge = document.getElementById('tracking-nav-badge');
        if (!badge) return;
        if (this.currentSessionId) {
            badge.style.display = 'inline-flex';
            badge.textContent   = 'ACTIVE';
        } else {
            badge.style.display = 'none';
        }
    },

    /* ─────────────────────────────
       PHASE 1 — TRACKING ACTIONS
    ───────────────────────────── */

    async startTracking() {
        const name  = document.getElementById('track-patient-name')?.value?.trim();
        const meds  = document.getElementById('track-medicines')?.value?.trim();
        const rxId  = parseInt(document.getElementById('track-rx-id')?.value || '0');

        if (!name || !meds) {
            tracking.showToast('Please enter patient name and medicines.', 'warning');
            return;
        }

        const medList = meds.split(',').map(m => m.trim()).filter(Boolean);

        try {
            const res = await fetch('/api/tracking/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rx_id: rxId || 0, patient_name: name, medicine_names: medList })
            });
            const data = await res.json();
            this.saveSession({ session_id: data.session_id, patient_name: name, medicine_names: medList });
            this.updateTrackingBadge();
            tracking.showToast('✅ Tracking session started!', 'success');
            tracking.closeModal('start-tracking-modal');
            app.showSection('tracking-section');
            tracking.loadTrackingDashboard();
        } catch (e) {
            tracking.showToast('Error starting session. Please try again.', 'error');
        }
    },

    async endTracking() {
        if (!this.currentSessionId) return;
        if (!confirm('End the current tracking session?')) return;

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/end`, { method: 'POST' });
            this.clearSession();
            this.updateTrackingBadge();
            tracking.showToast('Session ended. View your report below.', 'info');
            this.loadTrackingDashboard();
        } catch (e) {
            tracking.showToast('Error ending session.', 'error');
        }
    },

    async logAdherence(taken) {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const med  = document.getElementById('adherence-medicine')?.value?.trim();
        const time = document.getElementById('adherence-time')?.value;

        if (!med) { tracking.showToast('Select a medicine.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/adherence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    medicine_name: med,
                    dose_time: time || new Date().toLocaleTimeString(),
                    taken
                })
            });
            tracking.showToast(taken ? '💊 Dose logged as taken!' : '⚠️ Missed dose recorded.', taken ? 'success' : 'warning');
            tracking.closeModal('checkin-modal');
            this.loadAdherenceHistory();
        } catch (e) {
            tracking.showToast('Error logging adherence.', 'error');
        }
    },

    async logSymptom() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const type   = document.getElementById('symptom-type-input')?.value?.trim();
        const sev    = parseInt(document.getElementById('symptom-severity')?.value || '5');
        const before = document.getElementById('symptom-before')?.checked;
        const notes  = document.getElementById('symptom-notes')?.value?.trim();

        if (!type) { tracking.showToast('Describe your symptom.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/symptom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    symptom_type: type,
                    severity: sev,
                    before_medicine: before ?? true,
                    notes: notes || null
                })
            });
            tracking.showToast('🩺 Symptom logged.', 'success');
            tracking.closeModal('symptom-modal');
        } catch (e) {
            tracking.showToast('Error logging symptom.', 'error');
        }
    },

    async logSideEffect() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const med     = document.getElementById('se-medicine')?.value?.trim();
        const effect  = document.getElementById('se-effect')?.value?.trim();
        const sev     = parseInt(document.getElementById('se-severity')?.value || '5');
        const onset   = document.getElementById('se-onset')?.value || 'Unknown';
        const dur     = document.getElementById('se-duration')?.value || 'Unknown';
        const action  = document.getElementById('se-action')?.value?.trim() || null;

        if (!med || !effect) { tracking.showToast('Medicine and effect are required.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/sideeffect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    medicine_name: med,
                    effect, severity: sev,
                    onset_time: onset,
                    duration: dur,
                    action_taken: action
                })
            });
            tracking.showToast('⚠️ Side effect logged.', 'success');
            tracking.closeModal('sideeffect-modal');
        } catch (e) {
            tracking.showToast('Error logging side effect.', 'error');
        }
    },

    async logEffectiveness() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const med    = document.getElementById('eff-medicine')?.value?.trim();
        const rating = parseInt(document.getElementById('eff-rating')?.value || '7');
        const area   = document.getElementById('eff-area')?.value?.trim();

        if (!med || !area) { tracking.showToast('All fields required.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/effectiveness`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    medicine_name: med,
                    rating, improvement_area: area
                })
            });
            tracking.showToast('⭐ Effectiveness rated!', 'success');
            tracking.closeModal('effectiveness-modal');
        } catch (e) {
            tracking.showToast('Error saving rating.', 'error');
        }
    },

    async addNote() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const type    = document.getElementById('note-type')?.value || 'general';
        const content = document.getElementById('note-content')?.value?.trim();

        if (!content) { tracking.showToast('Write your note first.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    note_type: type, content
                })
            });
            tracking.showToast('📝 Note saved.', 'success');
            tracking.closeModal('note-modal');
            this.loadJournal();
        } catch (e) {
            tracking.showToast('Error saving note.', 'error');
        }
    },

    async createGoal() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const name   = document.getElementById('goal-name')?.value?.trim();
        const target = document.getElementById('goal-target')?.value?.trim();

        if (!name || !target) { tracking.showToast('Name and target required.', 'warning'); return; }

        try {
            await fetch(`/api/tracking/${this.currentSessionId}/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    goal_name: name, target
                })
            });
            tracking.showToast('🎯 Goal created!', 'success');
            tracking.closeModal('goal-modal');
            this.loadGoals();
        } catch (e) {
            tracking.showToast('Error creating goal.', 'error');
        }
    },

    async updateGoalProgress(goalId, progress) {
        if (!this.currentSessionId) return;
        try {
            await fetch(`/api/tracking/${this.currentSessionId}/goals/${goalId}?progress=${progress}`, {
                method: 'PUT'
            });
            this.loadGoals();
        } catch {}
    },

    /* ─────────────────────────────
       PHASE 2 — ANALYTICS LOADERS
    ───────────────────────────── */

    async loadTrackingDashboard() {
        if (!this.currentSessionId) {
            this.renderNoSession();
            return;
        }

        try {
            const [summary, insights, status] = await Promise.all([
                fetch(`/api/tracking/${this.currentSessionId}/daily-summary`).then(r => r.json()),
                fetch(`/api/tracking/${this.currentSessionId}/insights`).then(r => r.json()),
                fetch(`/api/tracking/${this.currentSessionId}/status`).then(r => r.json())
            ]);

            this.renderDashboard(summary, insights, status);
        } catch (e) {
            document.getElementById('tracking-dashboard')?.insertAdjacentHTML('afterbegin',
                '<div class="med-alert warning">Could not load tracking data.</div>');
        }
    },

    renderDashboard(summary, insights, status) {
        const container = document.getElementById('tracking-dashboard');
        if (!container) return;

        const meds = this.currentSession?.medicine_names || [];
        const medBadges = (Array.isArray(meds) ? meds : meds.split(','))
            .map(m => `<span class="med-badge blue">${m.trim()}</span>`).join(' ');

        container.innerHTML = `
            <!-- Session Banner -->
            <div class="med-card blue-accent no-hover anim-fade-in-down" style="margin-bottom: 24px;">
                <div class="med-flex-between">
                    <div>
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                            <span class="pulse-dot"></span>
                            <span style="font-size:.8rem;font-weight:700;color:var(--alert-green);text-transform:uppercase;letter-spacing:1px;">Active Session</span>
                        </div>
                        <h3 style="font-size:1.25rem;margin-bottom:6px;">${status.patient_name || this.currentSession?.patient_name || 'Patient'}</h3>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">${medBadges}</div>
                    </div>
                    <button class="btn-med btn-med-danger" onclick="tracking.endTracking()" style="flex-shrink:0;">
                        ⏹ End Session
                    </button>
                </div>
            </div>

            <!-- Stats Row -->
            <div class="med-grid-4 card-stagger" style="margin-bottom:24px;">
                <div class="stat-card">
                    <div class="stat-icon blue">💊</div>
                    <div class="stat-value">${summary.adherence_count}</div>
                    <div class="stat-label">Doses Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon teal">⭐</div>
                    <div class="stat-value">${insights.effectiveness_avg || '—'}</div>
                    <div class="stat-label">Avg Effectiveness</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon ${summary.avg_side_effect_severity > 5 ? 'red' : 'green'}">🩺</div>
                    <div class="stat-value">${summary.avg_side_effect_severity || '—'}</div>
                    <div class="stat-label">Avg Side Effect</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">📅</div>
                    <div class="stat-value">${insights.days_tracked}</div>
                    <div class="stat-label">Days Tracked</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="med-card anim-fade-in-up" style="margin-bottom:24px;">
                <h4 style="margin-bottom:16px;">⚡ Quick Log</h4>
                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    <button class="btn-med btn-med-primary" onclick="tracking.openModal('checkin-modal')">💊 Log Dose</button>
                    <button class="btn-med btn-med-secondary" onclick="tracking.openModal('symptom-modal')">🩺 Log Symptom</button>
                    <button class="btn-med btn-med-outline" onclick="tracking.openModal('sideeffect-modal')">⚠️ Side Effect</button>
                    <button class="btn-med btn-med-outline" onclick="tracking.openModal('effectiveness-modal')">⭐ Rate Medicine</button>
                    <button class="btn-med btn-med-ghost" onclick="tracking.openModal('note-modal')">📝 Add Note</button>
                </div>
            </div>

            <!-- Insights -->
            ${insights.insights.length ? `
            <div class="med-card anim-fade-in-up anim-delay-2" style="margin-bottom:24px;">
                <h4 style="margin-bottom:16px;">💡 Your Insights</h4>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${insights.insights.map(i => `<div class="med-alert success">${i}</div>`).join('')}
                </div>
            </div>` : ''}

            <!-- Weekly Chart Placeholder -->
            <div class="med-card anim-fade-in-up anim-delay-3" style="margin-bottom:24px;">
                <div class="med-flex-between" style="margin-bottom:16px;">
                    <h4>📊 This Week</h4>
                    <button class="btn-med btn-med-ghost" onclick="tracking.loadWeeklyStats()">Refresh</button>
                </div>
                <div id="weekly-chart" style="min-height:120px;display:flex;align-items:flex-end;gap:8px;justify-content:space-around;">
                    <div class="med-flex-center" style="width:100%;color:var(--text-muted);">Loading...</div>
                </div>
            </div>
        `;

        this.loadWeeklyStats();
        this.loadAdherenceHistory();
    },

    async loadWeeklyStats() {
        if (!this.currentSessionId) return;
        try {
            const data = await fetch(`/api/tracking/${this.currentSessionId}/weekly-stats`).then(r => r.json());
            const chart = document.getElementById('weekly-chart');
            if (!chart) return;

            const max = Math.max(...data.map(d => d.adherence), 1);
            const days = ['S','M','T','W','T','F','S','S'];
            chart.innerHTML = data.map((d, i) => {
                const h = Math.round((d.adherence / max) * 100);
                const date = new Date(d.date);
                const label = date.toLocaleDateString('en', { weekday: 'short' });
                return `
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
                        <div style="font-size:.75rem;font-weight:600;color:var(--primary-blue);">${d.adherence}</div>
                        <div style="width:100%;background:var(--bg-lighter);border-radius:6px;height:80px;display:flex;align-items:flex-end;overflow:hidden;">
                            <div class="chart-bar" style="width:100%;height:${Math.max(h, 4)}%;background:linear-gradient(0deg,var(--primary-blue),var(--secondary-teal));border-radius:6px;animation-delay:${i*0.08}s;"></div>
                        </div>
                        <div style="font-size:.7rem;color:var(--text-muted);">${label}</div>
                    </div>`;
            }).join('');
        } catch {}
    },

    async loadAdherenceHistory() {
        if (!this.currentSessionId) return;
        const container = document.getElementById('adherence-history');
        if (!container) return;

        try {
            const data = await fetch(`/api/tracking/${this.currentSessionId}/adherence`).then(r => r.json());
            if (!data.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">💊</div><p>No doses logged yet.</p></div>`;
                return;
            }
            container.innerHTML = data.slice(0, 10).map(item => `
                <div class="timeline-item">
                    <div class="timeline-dot" style="${item.taken ? 'background:var(--alert-green-light);color:var(--alert-green)' : 'background:var(--alert-red-light);color:var(--alert-red)'}">
                        ${item.taken ? '✓' : '✗'}
                    </div>
                    <div class="timeline-content">
                        <strong>${item.medicine_name}</strong>
                        <div style="font-size:.85rem;color:var(--text-muted);">${item.dose_time} · ${this.formatTime(item.timestamp)}</div>
                    </div>
                </div>
            `).join('');
        } catch {}
    },

    async loadJournal() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const container = document.getElementById('journal-entries');
        if (!container) return;

        container.innerHTML = '<div class="med-flex-center" style="padding:24px;"><div class="med-spinner"></div></div>';

        try {
            const notes = await fetch(`/api/tracking/${this.currentSessionId}/notes`).then(r => r.json());
            if (!notes.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No notes yet. Add your first note!</p></div>`;
                return;
            }
            container.innerHTML = notes.map(n => `
                <div class="med-card anim-fade-in-up" style="margin-bottom:12px;">
                    <div class="med-flex-between" style="margin-bottom:8px;">
                        <span class="med-badge ${this.noteTypeBadge(n.note_type)}">${n.note_type}</span>
                        <span style="font-size:.75rem;color:var(--text-muted);">${this.formatTime(n.timestamp)}</span>
                    </div>
                    <p style="color:var(--text-primary);margin:0;">${n.content}</p>
                </div>
            `).join('');
        } catch {
            container.innerHTML = `<div class="med-alert warning">Could not load journal.</div>`;
        }
    },

    async loadGoals() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const container = document.getElementById('goals-list');
        if (!container) return;

        container.innerHTML = '<div class="med-flex-center" style="padding:24px;"><div class="med-spinner"></div></div>';

        try {
            const goals = await fetch(`/api/tracking/${this.currentSessionId}/goals`).then(r => r.json());
            if (!goals.length) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>No goals yet. Set your first health goal!</p></div>`;
                return;
            }
            container.innerHTML = goals.map(g => `
                <div class="med-card anim-fade-in-up" style="margin-bottom:12px;">
                    <div class="med-flex-between" style="margin-bottom:10px;">
                        <div>
                            <strong>${g.goal_name}</strong>
                            <div style="font-size:.85rem;color:var(--text-muted);">Target: ${g.target}</div>
                        </div>
                        ${g.completed ? '<span class="med-badge green">✓ Completed</span>' : ''}
                    </div>
                    <div class="progress-bar-container" style="margin-bottom:8px;">
                        <div class="progress-bar-fill" style="width:${g.progress}%;"></div>
                    </div>
                    <div class="med-flex-between">
                        <span style="font-size:.8rem;color:var(--text-muted);">${g.progress}% complete</span>
                        ${!g.completed ? `
                        <div style="display:flex;gap:8px;">
                            <button class="btn-med btn-med-ghost" onclick="tracking.updateGoalProgress(${g.id}, Math.min(${g.progress}+10,100))">+10%</button>
                            <button class="btn-med btn-med-secondary" onclick="tracking.updateGoalProgress(${g.id}, 100)">Done ✓</button>
                        </div>` : ''}
                    </div>
                </div>
            `).join('');
        } catch {
            container.innerHTML = `<div class="med-alert warning">Could not load goals.</div>`;
        }
    },

    /* ─────────────────────────────
       PHASE 3 — REPORTS
    ───────────────────────────── */

    async loadReport() {
        if (!this.currentSessionId) { this.requireSession(); return; }
        const container = document.getElementById('report-preview');
        if (!container) return;

        container.innerHTML = '<div class="med-flex-center" style="padding:48px;"><div class="med-spinner"></div></div>';

        try {
            const data = await fetch(`/api/tracking/${this.currentSessionId}/report-preview`).then(r => r.json());
            const insights = await fetch(`/api/tracking/${this.currentSessionId}/insights`).then(r => r.json());
            const weekly = await fetch(`/api/tracking/${this.currentSessionId}/weekly-stats`).then(r => r.json());

            container.innerHTML = `
                <div class="med-card anim-fade-in-up" style="margin-bottom:20px;">
                    <div class="med-flex-between" style="margin-bottom:20px;">
                        <div>
                            <h3>🏥 Health Journey Report</h3>
                            <p style="color:var(--text-muted);font-size:.9rem;">Patient: <strong>${data.patient_name}</strong></p>
                        </div>
                        <button class="btn-med btn-med-primary" onclick="tracking.exportReport()">
                            📄 Export Report
                        </button>
                    </div>

                    <div class="med-grid-3 card-stagger" style="margin-bottom:20px;">
                        <div class="stat-card">
                            <div class="stat-icon blue">💊</div>
                            <div class="stat-value">${data.total_doses_logged}</div>
                            <div class="stat-label">Doses Logged</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon teal">📅</div>
                            <div class="stat-value">${data.days_tracked}</div>
                            <div class="stat-label">Days Tracked</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon green">⭐</div>
                            <div class="stat-value">${data.average_effectiveness}/10</div>
                            <div class="stat-label">Avg Effectiveness</div>
                        </div>
                    </div>

                    <div style="margin-bottom:16px;">
                        <h4 style="margin-bottom:10px;">💊 Medicines Tracked</h4>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;">
                            ${data.medicines.map(m => `<span class="med-badge blue">${m.trim()}</span>`).join('')}
                        </div>
                    </div>

                    ${insights.insights.length ? `
                    <div style="margin-bottom:16px;">
                        <h4 style="margin-bottom:10px;">💡 Key Insights</h4>
                        ${insights.insights.map(i => `<div class="med-alert success" style="margin-bottom:6px;">${i}</div>`).join('')}
                    </div>` : ''}

                    <div class="med-alert info">
                        <span>📋</span>
                        <span>${data.recommendations}</span>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div class="med-alert danger">Could not generate report preview.</div>`;
        }
    },

    async exportReport() {
        if (!this.currentSessionId) return;
        try {
            const data = await fetch(`/api/tracking/${this.currentSessionId}/export-report`).then(r => r.json());
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `health-report-${data.data.patient_name}-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            tracking.showToast('📄 Report exported!', 'success');
        } catch {
            tracking.showToast('Error exporting report.', 'error');
        }
    },

    /* ─────────────────────────────
       HELPERS
    ───────────────────────────── */

    requireSession() {
        tracking.showToast('Please start a tracking session first.', 'warning');
        app.showSection('tracking-section');
    },

    renderNoSession() {
        const container = document.getElementById('tracking-dashboard');
        if (!container) return;
        container.innerHTML = `
            <div class="med-card med-flex-center" style="flex-direction:column;gap:20px;text-align:center;padding:48px;min-height:340px;">
                <div style="font-size:4rem;">📋</div>
                <div>
                    <h3 style="margin-bottom:8px;">No Active Session</h3>
                    <p style="color:var(--text-muted);max-width:400px;">Start tracking your medicine journey to monitor adherence, symptoms, and effectiveness.</p>
                </div>
                <button class="btn-med btn-med-primary" style="font-size:1rem;padding:14px 28px;" onclick="tracking.openModal('start-tracking-modal')">
                    🚀 Start Tracking
                </button>
            </div>
        `;
    },

    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');

        // Pre-fill medicine dropdowns
        const meds = this.currentSession?.medicine_names || [];
        const medArr = Array.isArray(meds) ? meds : meds.split(',');
        ['adherence-medicine','se-medicine','eff-medicine'].forEach(fieldId => {
            const sel = document.getElementById(fieldId);
            if (!sel || !medArr.length) return;
            sel.innerHTML = medArr.map(m => `<option value="${m.trim()}">${m.trim()}</option>`).join('');
        });
    },

    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    },

    formatTime(ts) {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        } catch { return ts; }
    },

    noteTypeBadge(type) {
        const map = { general: 'blue', symptom: 'red', observation: 'teal', question: 'green' };
        return map[type] || 'blue';
    },

    showToast(message, type = 'info') {
        let toast = document.getElementById('med-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'med-toast';
            document.body.appendChild(toast);
        }
        const colors = {
            success: '#27AE60', warning: '#F5A623', error: '#FF4757', info: '#0066FF'
        };
        toast.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:9999;
            background:${colors[type]||colors.info}; color:white;
            padding:14px 20px; border-radius:12px;
            box-shadow:0 8px 24px rgba(0,0,0,0.2);
            font-weight:600; font-size:.9rem; max-width:320px;
            animation: notif-slide-in 0.3s ease;
        `;
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.animation = 'notif-slide-out 0.3s ease forwards';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 3500);
    }
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => tracking.init());
