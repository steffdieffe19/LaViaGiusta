import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tourist-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans p-8">
      <div class="max-w-4xl mx-auto space-y-6">
        <h2 class="text-3xl font-extrabold text-slate-900">Badge dell'escursionista 🥇</h2>
        <p class="text-slate-500">Gestisci le tue escursioni, il passaporto digitale e le statistiche.</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div class="bg-white rounded-3xl p-6 border border-slate-150 shadow-md shadow-slate-100/50 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <span class="text-3xl">🏁</span>
            <h4 class="font-extrabold text-xl text-slate-900 mt-2">12</h4>
            <p class="text-xs text-slate-400 uppercase tracking-wider font-bold mt-1">Sentieri Completati</p>
          </div>

          <div class="bg-white rounded-3xl p-6 border border-slate-150 shadow-md shadow-slate-100/50 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <span class="text-3xl">⛰️</span>
            <h4 class="font-extrabold text-xl text-slate-900 mt-2">+4.250 m</h4>
            <p class="text-xs text-slate-400 uppercase tracking-wider font-bold mt-1">Dislivello Accumulato</p>
          </div>

          <div class="bg-white rounded-3xl p-6 border border-slate-150 shadow-md shadow-slate-100/50 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <span class="text-3xl">🎫</span>
            <h4 class="font-extrabold text-xl text-slate-900 mt-2">8 / 10</h4>
            <p class="text-xs text-slate-400 uppercase tracking-wider font-bold mt-1">Timbri Passaporto</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TouristDashboardComponent {}
