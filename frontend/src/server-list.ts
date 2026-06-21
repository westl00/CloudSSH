import { SSHTerminal } from './terminal';

interface UserInfo {
  id: number;
  github_id: number;
  username: string;
  avatar_url: string;
}

interface ServerConfig {
  id: number;
  user_id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: 'password' | 'publickey';
  created_at: string;
  updated_at: string;
}

/**
 * 鐢ㄦ埛绌洪棿 鈥?鏈嶅姟鍣ㄥ垪琛ㄧ鐞嗙粍浠?
 */
export class ServerList {
  private user: UserInfo;
  private servers: ServerConfig[] = [];
  private onConnect: (wsUrl: string, serverName: string) => void;
  private onLogout: () => void;
  private editingServerId: number | null = null;
  private modalAuthMode: 'password' | 'key' = 'password';

  constructor(
    user: UserInfo,
    onConnect: (wsUrl: string, serverName: string) => void,
    onLogout: () => void
  ) {
    this.user = user;
    this.onConnect = onConnect;
    this.onLogout = onLogout;
    this.init();
  }

  private async init(): Promise<void> {
    this.renderUserInfo();
    this.bindEvents();
    await this.fetchServers();

    // 璁剧疆鐢ㄦ埛绌洪棿鐨勭増鏉冨勾浠?
    const yearSpan = document.getElementById('user-copyright-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();
  }

  // ==================== 娓叉煋鐢ㄦ埛淇℃伅 ====================

  private renderUserInfo(): void {
    const container = document.getElementById('user-info');
    if (!container) return;

    container.innerHTML = `
      <img src="${this.user.avatar_url}" alt="${this.user.username}" class="user-avatar w-8 h-8" />
      <span class="text-xs font-bold tracking-[0.1em] text-[#94a3b8]">${this.user.username}</span>
    `;
  }

  // ==================== 浜嬩欢缁戝畾 ====================

  private bindEvents(): void {
    // 閫€鍑虹櫥褰?
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

    // 娣诲姞鏈嶅姟鍣ㄦ寜閽?
    document.getElementById('add-server-btn')?.addEventListener('click', () => this.showModal('add'));
    document.getElementById('empty-add-btn')?.addEventListener('click', () => this.showModal('add'));

    // Modal 鍏抽棴
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.hideModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', () => this.hideModal());

    // Modal 鎻愪氦
    document.getElementById('server-submit-btn')?.addEventListener('click', () => this.handleSubmit());

    // Modal 璁よ瘉鏂瑰紡鍒囨崲
    document.getElementById('modal-auth-tab-password')?.addEventListener('click', () => this.setModalAuthMode('password'));
    document.getElementById('modal-auth-tab-key')?.addEventListener('click', () => this.setModalAuthMode('key'));

    // 鍥炶溅鎻愪氦
    document.getElementById('server-form')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  }

  // ==================== 鏁版嵁鑾峰彇 ====================

  private async fetchServers(): Promise<void> {
    try {
      const res = await fetch('/api/servers');
      if (!res.ok) throw new Error('Failed to fetch servers');
      this.servers = await res.json();
      this.renderServerGrid();
    } catch (e) {
      console.error('Failed to fetch servers:', e);
      this.servers = [];
      this.renderServerGrid();
    }
  }

  // ==================== 娓叉煋鏈嶅姟鍣ㄥ崱鐗?====================

  private renderServerGrid(): void {
    const grid = document.getElementById('server-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid || !emptyState) return;

    if (this.servers.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      return;
    }

    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    grid.innerHTML = this.servers
      .map((server) => this.renderServerCard(server))
      .join('');

    // 缁戝畾鍗＄墖浜嬩欢
    this.servers.forEach((server) => {
      document.getElementById(`connect-${server.id}`)?.addEventListener('click', () => this.connectServer(server.id));
      document.getElementById(`edit-${server.id}`)?.addEventListener('click', () => this.showModal('edit', server));
      document.getElementById(`delete-${server.id}`)?.addEventListener('click', () => this.deleteServer(server.id));
    });
  }

  private renderServerCard(server: ServerConfig): string {
    const authIcon = server.auth_method === 'publickey' ? 'vpn_key' : 'password';
    const authLabel = server.auth_method === 'publickey' ? 'KEY' : 'PWD';

    return `
      <div class="server-card p-5 relative group" id="card-${server.id}">
        <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#334155] to-transparent group-hover:via-[#3b82f6] transition-all duration-300"></div>
        
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#3b82f6]" style="font-size: 20px; font-variation-settings: 'FILL' 0;">dns</span>
            <h3 class="text-sm font-bold text-[#3b82f6] tracking-[0.05em]">${this.escapeHtml(server.name)}</h3>
          </div>
          <span class="text-[10px] font-bold tracking-[0.1em] text-[#94a3b8] border border-[#334155] px-2 py-0.5 flex items-center gap-1">
            <span class="material-symbols-outlined" style="font-size: 12px;">${authIcon}</span>
            ${authLabel}
          </span>
        </div>

        <div class="space-y-1.5 text-xs text-[#94a3b8] mb-4">
          <div class="flex items-center gap-2">
            <span class="text-[#334155]">HOST</span>
            <span class="text-[#e5e2e1]">${this.escapeHtml(server.host)}:${server.port}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[#334155]">USER</span>
            <span class="text-[#e5e2e1]">${this.escapeHtml(server.username)}</span>
          </div>
        </div>

        <div class="flex gap-2 pt-3 border-t border-[#1f1f1f]">
          <button id="connect-${server.id}" class="cyber-button flex-1 py-1.5 px-3 text-[10px] font-bold tracking-[0.1em] uppercase flex items-center justify-center gap-1" title="Connect">
            <span class="material-symbols-outlined" style="font-size: 14px;">power_settings_new</span>
            CONNECT
          </button>
          <button id="edit-${server.id}" class="cyber-button py-1.5 px-3 text-[10px] font-bold tracking-[0.1em] flex items-center justify-center" title="Edit">
            <span class="material-symbols-outlined" style="font-size: 14px;">edit</span>
          </button>
          <button id="delete-${server.id}" class="cyber-button py-1.5 px-3 text-[10px] font-bold tracking-[0.1em] flex items-center justify-center text-[#ffb4ab] border-[#ffb4ab] hover:bg-[#ffb4ab] hover:text-[#0f172a]" title="Delete">
            <span class="material-symbols-outlined" style="font-size: 14px;">delete</span>
          </button>
        </div>
      </div>
    `;
  }

  // ==================== 鏈嶅姟鍣ㄦ搷浣?====================

  private async connectServer(serverId: number): Promise<void> {
    const server = this.servers.find((s) => s.id === serverId);
    if (!server) return;

    const connectBtn = document.getElementById(`connect-${serverId}`);
    if (connectBtn) {
      connectBtn.innerHTML = `
        <span class="material-symbols-outlined animate-spin" style="font-size: 14px;">progress_activity</span>
        CONNECTING...
      `;
      (connectBtn as HTMLButtonElement).disabled = true;
    }

    try {
      const res = await fetch(`/api/servers/${serverId}/connect`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Connection failed');
      }

      const { wsUrl } = await res.json() as { wsUrl: string };
      this.onConnect(wsUrl, server.name);

      // 杩炴帴鎴愬姛璺宠浆缁堢鍚庯紝绔嬪嵆鎭㈠鎸夐挳鐨勫師濮嬬姸鎬侊紝浠ヤ究鐢ㄦ埛鏂紑杩炴帴杩斿洖鍚庣湅鍒扮殑鏄甯告寜閽?
      if (connectBtn) {
        connectBtn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 14px;">power_settings_new</span>
          CONNECT
        `;
        (connectBtn as HTMLButtonElement).disabled = false;
      }
    } catch (e) {
      alert(`杩炴帴澶辫触: ${e instanceof Error ? e.message : String(e)}`);
      // 鎭㈠鎸夐挳鐘舵€?
      if (connectBtn) {
        connectBtn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 14px;">power_settings_new</span>
          CONNECT
        `;
        (connectBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  private async deleteServer(serverId: number): Promise<void> {
    const server = this.servers.find((s) => s.id === serverId);
    if (!server) return;

    if (!confirm(`纭鍒犻櫎鏈嶅姟鍣?"${server.name}" ?`)) return;

    try {
      const card = document.getElementById(`card-${serverId}`);
      if (card) card.classList.add('removing');

      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      // 绛夊緟鍔ㄧ敾瀹屾垚鍚庣Щ闄?
      await new Promise((r) => setTimeout(r, 300));
      this.servers = this.servers.filter((s) => s.id !== serverId);
      this.renderServerGrid();
    } catch (e) {
      alert(`鍒犻櫎澶辫触: ${e instanceof Error ? e.message : String(e)}`);
      await this.fetchServers();
    }
  }

  // ==================== Modal 鎿嶄綔 ====================

  showModal(mode: 'add' | 'edit', server?: ServerConfig): void {
    this.editingServerId = mode === 'edit' && server ? server.id : null;

    const modal = document.getElementById('server-modal');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('server-submit-btn');
    if (!modal || !title || !submitBtn) return;

    title.textContent = mode === 'add' ? 'Add Server' : 'EDIT_SERVER';
    submitBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 18px;">save</span>
      ${mode === 'add' ? 'Save server' : 'UPDATE_SERVER'}
    `;

    // 濉厖琛ㄥ崟
    if (mode === 'edit' && server) {
      (document.getElementById('server-name') as HTMLInputElement).value = server.name;
      (document.getElementById('server-host') as HTMLInputElement).value = server.host;
      (document.getElementById('server-port') as HTMLInputElement).value = server.port.toString();
      (document.getElementById('server-username') as HTMLInputElement).value = server.username;
      (document.getElementById('server-password') as HTMLInputElement).value = '';
      (document.getElementById('server-private-key') as HTMLTextAreaElement).value = '';

      if (server.auth_method === 'publickey') {
        this.setModalAuthMode('key');
      } else {
        this.setModalAuthMode('password');
      }
    } else {
      // 娓呯┖琛ㄥ崟
      (document.getElementById('server-name') as HTMLInputElement).value = '';
      (document.getElementById('server-host') as HTMLInputElement).value = '';
      (document.getElementById('server-port') as HTMLInputElement).value = '22';
      (document.getElementById('server-username') as HTMLInputElement).value = '';
      (document.getElementById('server-password') as HTMLInputElement).value = '';
      (document.getElementById('server-private-key') as HTMLTextAreaElement).value = '';
      this.setModalAuthMode('password');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // 鑱氱劍绗竴涓緭鍏ユ
    setTimeout(() => {
      (document.getElementById('server-name') as HTMLInputElement)?.focus();
    }, 100);
  }

  hideModal(): void {
    const modal = document.getElementById('server-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.editingServerId = null;
  }

  private setModalAuthMode(mode: 'password' | 'key'): void {
    this.modalAuthMode = mode;
    const pwTab = document.getElementById('modal-auth-tab-password')!;
    const keyTab = document.getElementById('modal-auth-tab-key')!;
    const pwSection = document.getElementById('modal-password-section')!;
    const keySection = document.getElementById('modal-key-section')!;

    if (mode === 'password') {
      pwTab.style.background = '#3b82f6'; pwTab.style.color = '#0f172a';
      pwTab.style.borderColor = '#3b82f6';
      keyTab.style.background = 'transparent'; keyTab.style.color = '#94a3b8';
      keyTab.style.borderColor = '#334155';
      pwSection.style.display = ''; keySection.style.display = 'none';
    } else {
      keyTab.style.background = '#3b82f6'; keyTab.style.color = '#0f172a';
      keyTab.style.borderColor = '#3b82f6';
      pwTab.style.background = 'transparent'; pwTab.style.color = '#94a3b8';
      pwTab.style.borderColor = '#334155';
      keySection.style.display = ''; pwSection.style.display = 'none';
    }
  }

  private async handleSubmit(): Promise<void> {
    const name = (document.getElementById('server-name') as HTMLInputElement).value.trim();
    const host = (document.getElementById('server-host') as HTMLInputElement).value.trim();
    const port = parseInt((document.getElementById('server-port') as HTMLInputElement).value || '22');
    const username = (document.getElementById('server-username') as HTMLInputElement).value.trim();
    const password = (document.getElementById('server-password') as HTMLInputElement).value;
    const privateKey = (document.getElementById('server-private-key') as HTMLTextAreaElement).value;

    if (!name || !host || !username) {
      alert('请填写服务器名称、主机和用户名');
      return;
    }

    const authMethod = this.modalAuthMode === 'key' ? 'publickey' : 'password';
    const credential = authMethod === 'publickey' ? privateKey : password;

    // 新增时必须填写凭据，编辑时可留空
    if (!this.editingServerId && !credential) {
      alert(authMethod === 'publickey' ? '请粘贴私钥内容' : '请输入密码');
      return;
    }

    const submitBtn = document.getElementById('server-submit-btn') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="material-symbols-outlined animate-spin" style="font-size: 18px;">progress_activity</span>
      SAVING...
    `;

    try {
      const body: any = { name, host, port, username, auth_method: authMethod };
      if (credential) body.credential = credential;

      let res: Response;
      if (this.editingServerId) {
        res = await fetch(`/api/servers/${this.editingServerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Save failed');
      }

      this.hideModal();
      await this.fetchServers();
    } catch (e) {
      alert(`淇濆瓨澶辫触: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">save</span>
        ${this.editingServerId ? 'UPDATE_SERVER' : 'Save server'}
      `;
    }
  }

  // ==================== 閫€鍑虹櫥褰?====================

  private async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 鍗充娇璇锋眰澶辫触涔熸竻闄ゆ湰鍦扮姸鎬?
    }
    this.onLogout();
  }

  // ==================== 宸ュ叿鍑芥暟 ====================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
