import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

export interface PostCommentListItem {
  id: string;
  userId: string;
  postId: string;
  content: string;
  createdAt: string;
  user: {
    fullName: string;
  };
}

export interface CommunityPost {
  id: string;
  userId: string;
  trailId: string;
  imagePath: string;
  caption: string;
  createdAt: string;
  user: {
    fullName: string;
  };
  trail: {
    name: string;
    code: string;
  };
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  showComments?: boolean;
  loadingComments?: boolean;
  comments?: PostCommentListItem[];
  newCommentText?: string;
  submittingComment?: boolean;
}

export interface TrailListItem {
  id: string;
  code: string;
  name: string;
}

@Component({
  selector: 'app-community-feed',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <!-- Hero Section -->
      <div class="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white py-16 px-4 md:px-10 relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none"></div>
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <nav class="flex text-xs text-emerald-250/80 gap-1.5 items-center font-medium mb-3">
              <a routerLink="/" class="hover:text-white transition-colors">Home</a>
              <span>/</span>
              <span class="text-white font-semibold">Community Feed</span>
            </nav>
            <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
              📸 Community Explorer
            </h1>
            <p class="text-emerald-100/90 mt-2 text-sm md:text-base max-w-2xl font-light font-sans leading-relaxed">
              Condividi le tue escursioni, scatta foto mozzafiato lungo i sentieri di Valle Castellana e tagga il percorso ufficiale per aiutare altri appassionati.
            </p>
          </div>

          <!-- Add Post Button / Login Callout -->
          @if (authService.isLoggedIn()) {
            <button (click)="openModal()" 
              class="shrink-0 px-6 py-3.5 bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded-2xl text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer border border-emerald-100">
              <span>📸</span> Condividi Avventura
            </button>
          } @else {
            <div class="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-sm max-w-xs w-full">
              <p class="text-emerald-50 font-medium mb-2 text-xs">Vuoi condividere le tue foto?</p>
              <a routerLink="/auth" [queryParams]="{ mode: 'login' }"
                 class="inline-flex items-center justify-center w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors">
                🔑 Accedi o Registrati
              </a>
            </div>
          }
        </div>
      </div>

      <div class="max-w-6xl mx-auto px-4 md:px-10 py-12">
        <!-- Notifications -->
        @if (error()) {
          <div class="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm shadow-sm">
            <span class="text-base">⚠️</span>
            <div class="flex-1">
              <p class="font-semibold">Errore</p>
              <p class="text-xs mt-0.5">{{ error() }}</p>
            </div>
            <button (click)="error.set(null)" class="text-red-400 hover:text-red-650 font-bold text-lg cursor-pointer">×</button>
          </div>
        }

        @if (success()) {
          <div class="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-start gap-3 text-sm shadow-sm">
            <span class="text-base">✨</span>
            <div class="flex-1">
              <p class="font-semibold">Operazione Completata</p>
              <p class="text-xs mt-0.5">{{ success() }}</p>
            </div>
            <button (click)="success.set(null)" class="text-emerald-400 hover:text-emerald-650 font-bold text-lg cursor-pointer">×</button>
          </div>
        }

        <!-- Loading State -->
        @if (loadingPosts()) {
          <div class="flex flex-col items-center justify-center py-24 gap-4">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            <p class="text-slate-400 text-sm animate-pulse">Caricamento delle avventure…</p>
          </div>
        }

        <!-- Empty State -->
        @else if (posts.length === 0) {
          <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-md shadow-slate-100/50 space-y-4">
            <span class="text-5xl block">🏔️</span>
            <h4 class="font-extrabold text-xl text-slate-900">Il feed è ancora silenzioso</h4>
            <p class="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              Sii il primo a rompere il ghiaccio! Carica una foto del tuo sentiero preferito e fai conoscere la bellezza di Valle Castellana.
            </p>
            @if (authService.isLoggedIn()) {
              <button (click)="openModal()"
                class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-200 hover:shadow-lg cursor-pointer">
                📸 Pubblica il primo post
              </button>
            }
          </div>
        }

        <!-- Posts Grid -->
        @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            @for (post of posts; track post.id) {
              <div class="group bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col overflow-hidden">
                
                <!-- Card Header: User info -->
                <div class="p-4 flex items-center gap-3 bg-slate-50/50 border-b border-slate-100">
                  <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                    {{ getUserInitials(post.user.fullName) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-slate-800 truncate leading-tight">{{ post.user.fullName }}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">{{ formatDate(post.createdAt) }}</p>
                  </div>
                </div>

                <!-- Card Image -->
                <div class="relative overflow-hidden aspect-video md:aspect-[4/3] bg-slate-905 flex items-center justify-center">
                  <img [src]="getBackendUrl(post.imagePath)" 
                       [alt]="post.caption" 
                       class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>

                <!-- Card Body: Caption & Trail Link -->
                <div class="p-5 flex-1 flex flex-col justify-between gap-4">
                  <p class="text-sm text-slate-650 leading-relaxed font-normal italic">
                    “{{ post.caption }}”
                  </p>

                  <!-- Tagged Trail Link Chip -->
                  <div class="pt-2 border-t border-slate-50">
                    <a [routerLink]="['/trail-detail', post.trailId]"
                       class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-250 text-emerald-800 text-xs font-bold transition-all shadow-sm">
                      <span>📍 Mappa:</span>
                      <span class="underline decoration-dotted truncate max-w-[130px]" [title]="post.trail.name">
                        {{ post.trail.name }}
                      </span>
                      <span class="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-extrabold uppercase">
                        {{ post.trail.code }}
                      </span>
                    </a>
                  </div>

                  <!-- Action Bar (Likes and Comments) -->
                  <div class="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                    <!-- Like/Applaud button -->
                    <button (click)="toggleLike(post)"
                            class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                            [ngClass]="post.hasLiked ? 'bg-orange-50 text-orange-650 hover:bg-orange-100 border-orange-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border-slate-100'">
                      <span>👏</span>
                      <span>{{ post.hasLiked ? 'Applaudito' : 'Applaudi' }}</span>
                      <span class="ml-0.5 bg-white/80 px-1.5 py-0.2 rounded-md border border-slate-200/40 text-[10px] font-extrabold">
                        {{ post.likesCount }}
                      </span>
                    </button>

                    <!-- Comments button -->
                    <button (click)="toggleComments(post)"
                            class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                            [ngClass]="post.showComments ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border-slate-100'">
                      <span>💬</span>
                      <span>Commenta</span>
                      <span class="ml-0.5 bg-white/80 px-1.5 py-0.2 rounded-md border border-slate-200/40 text-[10px] font-extrabold">
                        {{ post.commentsCount }}
                      </span>
                    </button>
                  </div>

                  <!-- Expanded Comments Section -->
                  @if (post.showComments) {
                    <div class="border-t border-slate-100 pt-3 mt-1 space-y-3">
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Commenti</h4>
                      
                      <!-- Comments list -->
                      <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                        @if (post.loadingComments) {
                          <div class="flex justify-center py-4">
                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                          </div>
                        } @else {
                          @for (comment of post.comments; track comment.id) {
                            <div class="bg-slate-50 rounded-2xl p-3 text-xs space-y-1 border border-slate-100/50">
                              <div class="flex items-center justify-between">
                                <span class="font-extrabold text-slate-800">{{ comment.user.fullName }}</span>
                                <span class="text-[10px] text-slate-400 font-sans">{{ formatDate(comment.createdAt) }}</span>
                              </div>
                              <p class="text-slate-650 leading-normal font-sans font-normal">{{ comment.content }}</p>
                            </div>
                          } @empty {
                            <p class="text-[11px] text-slate-400 text-center py-3 italic">Nessun commento. Lascia il primo commento!</p>
                          }
                        }
                      </div>

                      <!-- New comment box -->
                      @if (authService.isLoggedIn()) {
                        <div class="flex items-center gap-1.5 mt-2">
                          <input type="text" [(ngModel)]="post.newCommentText" placeholder="Scrivi un commento..."
                                 (keyup.enter)="submitComment(post)"
                                 class="flex-1 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-3 py-2 text-xs transition-all placeholder:text-slate-400 font-sans">
                          <button (click)="submitComment(post)" [disabled]="post.submittingComment || !post.newCommentText?.trim()"
                                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer min-h-[38px] flex items-center justify-center">
                            @if (post.submittingComment) {
                              <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                            } @else {
                              Invia
                            }
                          </button>
                        </div>
                      } @else {
                        <div class="bg-slate-50 rounded-xl p-2.5 text-center text-[10px] text-slate-400 border border-slate-100">
                          🔑 <a routerLink="/auth" class="underline font-bold text-slate-600 hover:text-emerald-700">Accedi</a> per aggiungere un commento.
                        </div>
                      }
                    </div>
                  }
                </div>

              </div>
            }
          </div>
        }
      </div>

      <!-- Creation Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300">
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] scale-100 animate-[fadeIn_0.2s_ease-out]">
            
            <!-- Modal Header -->
            <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                📸 Condividi la tua avventura
              </h3>
              <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600 font-extrabold text-2xl cursor-pointer w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                ×
              </button>
            </div>

            <!-- Modal Body (Scrollable form) -->
            <form (ngSubmit)="submitPost()" class="p-6 overflow-y-auto space-y-5 flex-1">
              
              <!-- Image Upload Area -->
              <div class="space-y-2">
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Immagine dell'avventura *</label>
                
                <div class="relative border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 transition-colors bg-slate-50/50 text-center flex flex-col items-center justify-center min-h-[160px]">
                  
                  @if (imagePreviewUrl) {
                    <div class="relative w-full max-h-[220px] rounded-xl overflow-hidden shadow-inner">
                      <img [src]="imagePreviewUrl" class="w-full h-full object-cover rounded-xl" alt="Preview">
                      <button type="button" (click)="removeSelectedFile()" 
                              class="absolute top-2 right-2 bg-red-650 hover:bg-red-700 text-white rounded-full p-1.5 shadow-md transition-colors hover:scale-105 cursor-pointer">
                        <span class="block w-4 h-4 text-xs font-extrabold flex items-center justify-center">🗑️</span>
                      </button>
                    </div>
                  } @else {
                    <div class="space-y-2 py-4">
                      <span class="text-4xl block">📷</span>
                      <p class="text-sm font-semibold text-slate-700">Seleziona un'immagine</p>
                      <p class="text-xs text-slate-400 font-sans">Trascina o clicca per sfogliare i file (PNG, JPG, max 10MB)</p>
                    </div>
                    <input type="file" accept="image/*" (change)="onFileSelected($event)" 
                           class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                  }
                </div>
              </div>

              <!-- Caption Textarea -->
              <div class="space-y-2">
                <label for="caption" class="block text-xs font-bold uppercase tracking-wider text-slate-500">Didascalia / Racconto *</label>
                <textarea id="caption" name="caption" [(ngModel)]="caption" required rows="3" placeholder="Scrivi una breve didascalia... Cosa hai visto di bello?"
                          class="w-full rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 p-3.5 text-sm transition-all placeholder:text-slate-400 resize-none font-sans"></textarea>
              </div>

              <!-- Trail Select Dropdown -->
              <div class="space-y-2">
                <label for="trailId" class="block text-xs font-bold uppercase tracking-wider text-slate-500">Sentiero Taggato *</label>
                <div class="relative">
                  <select id="trailId" name="trailId" [(ngModel)]="selectedTrailId" required
                          class="w-full appearance-none rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 p-3.5 pr-10 text-sm transition-all bg-white text-slate-800 font-sans">
                    <option value="" disabled selected>Seleziona un sentiero ufficiale...</option>
                    @for (trail of trails; track trail.id) {
                      <option [value]="trail.id">
                        {{ trail.code }} - {{ trail.name }}
                      </option>
                    }
                  </select>
                  <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-450 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              <!-- Modal Action Buttons -->
              <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button type="button" (click)="closeModal()" [disabled]="submittingPost()"
                        class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[44px]">
                  Annulla
                </button>
                <button type="submit" [disabled]="submittingPost() || !selectedFile || !caption || !selectedTrailId"
                        class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]">
                  @if (submittingPost()) {
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Caricamento...
                  } @else {
                    🚀 Pubblica
                  }
                </button>
              </div>

            </form>

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class CommunityFeedComponent implements OnInit {
  private readonly http = inject(HttpClient);
  public readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public posts: CommunityPost[] = [];
  public trails: TrailListItem[] = [];
  
  public readonly loadingPosts = signal<boolean>(false);
  public readonly submittingPost = signal<boolean>(false);
  public readonly showModal = signal<boolean>(false);
  public readonly error = signal<string | null>(null);
  public readonly success = signal<string | null>(null);

  // Form Fields
  public caption = '';
  public selectedTrailId = '';
  public selectedFile: File | null = null;
  public imagePreviewUrl: string | null = null;

  private readonly API_BASE_URL = environment.baseUrl;

  public ngOnInit(): void {
    this.loadPosts();
    this.loadTrails();
  }

  public loadPosts(): void {
    this.loadingPosts.set(true);

    let headers = new HttpHeaders();
    const token = localStorage.getItem('access_token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    this.http.get<{ success: boolean; data: CommunityPost[] }>(
      `${this.API_BASE_URL}/api/v1/community/posts`,
      { headers }
    )
      .pipe(
        catchError(err => {
          console.error('Error fetching community posts:', err);
          this.error.set('Impossibile caricare i post della community.');
          this.loadingPosts.set(false);
          return of({ success: false, data: [] as CommunityPost[] });
        })
      )
      .subscribe(res => {
        if (res && res.success && res.data) {
          this.posts = res.data.map((p: CommunityPost) => ({
            ...p,
            showComments: false,
            loadingComments: false,
            comments: [],
            newCommentText: '',
            submittingComment: false
          }));
        }
        this.loadingPosts.set(false);
      });
  }

  public loadTrails(): void {
    this.http.get<{ success: boolean; data: TrailListItem[] }>(`${this.API_BASE_URL}/api/v1/trails`)
      .pipe(
        catchError(err => {
          console.error('Error fetching trails:', err);
          return of({ success: false, data: [] as TrailListItem[] });
        })
      )
      .subscribe(res => {
        if (res.success) {
          this.trails = res.data;
        }
      });
  }

  public toggleLike(post: CommunityPost): void {
    if (!this.authService.isLoggedIn()) {
      this.error.set('Devi accedere per poter applaudire un post.');
      this.router.navigate(['/auth'], { queryParams: { mode: 'login' } });
      return;
    }

    // Optimistic UI Update
    const originalHasLiked = post.hasLiked;
    const originalLikesCount = post.likesCount;

    post.hasLiked = !post.hasLiked;
    post.likesCount = post.hasLiked ? post.likesCount + 1 : post.likesCount - 1;

    const token = localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.post<{ success: boolean; data: { liked: boolean; likesCount: number } }>(
      `${this.API_BASE_URL}/api/v1/community/posts/${post.id}/like`,
      {},
      { headers }
    )
      .pipe(
        catchError(err => {
          console.error('Error toggling like:', err);
          // Rollback on error
          post.hasLiked = originalHasLiked;
          post.likesCount = originalLikesCount;
          this.error.set('Impossibile registrare l\'applauso.');
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success) {
          post.hasLiked = res.data.liked;
          post.likesCount = res.data.likesCount;
        }
      });
  }

  public toggleComments(post: CommunityPost): void {
    post.showComments = !post.showComments;
    if (post.showComments) {
      this.loadComments(post);
    }
  }

  public loadComments(post: CommunityPost): void {
    post.loadingComments = true;
    this.http.get<{ success: boolean; data: PostCommentListItem[] }>(
      `${this.API_BASE_URL}/api/v1/community/posts/${post.id}/comments`
    )
      .pipe(
        catchError(err => {
          console.error('Error fetching comments:', err);
          post.loadingComments = false;
          return of({ success: false, data: [] as PostCommentListItem[] });
        })
      )
      .subscribe(res => {
        if (res.success) {
          post.comments = res.data;
        }
        post.loadingComments = false;
      });
  }

  public submitComment(post: CommunityPost): void {
    const text = post.newCommentText?.trim();
    if (!text) return;

    if (!this.authService.isLoggedIn()) {
      this.error.set('Devi accedere per poter aggiungere un commento.');
      this.router.navigate(['/auth'], { queryParams: { mode: 'login' } });
      return;
    }

    post.submittingComment = true;
    
    const token = localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.post<{ success: boolean; data: PostCommentListItem }>(
      `${this.API_BASE_URL}/api/v1/community/posts/${post.id}/comments`,
      { content: text },
      { headers }
    )
      .pipe(
        catchError(err => {
          console.error('Error creating comment:', err);
          this.error.set('Impossibile pubblicare il commento.');
          post.submittingComment = false;
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success) {
          post.comments = [...(post.comments || []), res.data];
          post.commentsCount += 1;
          post.newCommentText = '';
        }
        post.submittingComment = false;
      });
  }

  public openModal(): void {
    this.caption = '';
    this.selectedTrailId = '';
    this.selectedFile = null;
    this.imagePreviewUrl = null;
    this.error.set(null);
    this.showModal.set(true);
  }

  public closeModal(): void {
    this.showModal.set(false);
  }

  public onFileSelected(event: any): void {
    const file = event.target?.files?.[0] as File;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Per favore seleziona un file immagine valido (PNG, JPG, ecc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.error.set("L'immagine supera il limite massimo di 10MB");
      return;
    }

    this.selectedFile = file;
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
    this.error.set(null); // Clear errors if file is fine
  }

  public removeSelectedFile(): void {
    this.selectedFile = null;
    this.imagePreviewUrl = null;
  }

  public submitPost(): void {
    if (!this.selectedFile || !this.caption || !this.selectedTrailId) {
      this.error.set('Tutti i campi contrassegnati con * sono obbligatori');
      return;
    }

    this.submittingPost.set(true);
    this.error.set(null);

    const formData = new FormData();
    formData.append('image', this.selectedFile);
    formData.append('caption', this.caption);
    formData.append('trailId', this.selectedTrailId);

    const token = localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.post<{ success: boolean; data: CommunityPost }>(
      `${this.API_BASE_URL}/api/v1/community/posts`, 
      formData, 
      { headers }
    )
    .pipe(
      catchError(err => {
        console.error('Error creating post:', err);
        const errMsg = err?.error?.error || 'Errore durante la creazione del post. Riprova.';
        this.error.set(errMsg);
        this.submittingPost.set(false);
        return of(null);
      })
    )
    .subscribe(res => {
      if (res?.success) {
        this.success.set('Avventura condivisa con successo!');
        this.closeModal();
        this.loadPosts(); // Reload feed to show new post
      }
      this.submittingPost.set(false);
    });
  }

  // Helpers
  public getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  public formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  public getBackendUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    const path = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
    return `${this.API_BASE_URL}${path}`;
  }
}
