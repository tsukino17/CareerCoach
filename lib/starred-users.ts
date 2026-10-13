// 收藏用户的 localStorage 管理，支持备注和标签

export type StarTag = '标杆案例' | '潜力用户' | '问题用户' | '待跟进' | '其他';

export const STAR_TAGS: StarTag[] = ['标杆案例', '潜力用户', '问题用户', '待跟进', '其他'];

export const TAG_COLORS: Record<StarTag, string> = {
  '标杆案例': 'bg-amber-50 text-amber-700 border-amber-200',
  '潜力用户': 'bg-blue-50 text-blue-700 border-blue-200',
  '问题用户': 'bg-rose-50 text-rose-700 border-rose-200',
  '待跟进': 'bg-violet-50 text-violet-700 border-violet-200',
  '其他': 'bg-slate-50 text-slate-700 border-slate-200',
};

export type StarredUser = {
  id: string;
  note: string;
  tag: StarTag;
  starredAt: string;
};

const STARRED_USERS_KEY = 'admin_starred_users';

// 读取收藏用户列表（自动兼容旧的 string[] 格式）
export function getStarredUsers(): StarredUser[] {
  try {
    const raw = localStorage.getItem(STARRED_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // 兼容旧格式（纯 userId 数组）
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return (parsed as string[]).map((id) => ({
        id,
        note: '',
        tag: '其他' as StarTag,
        starredAt: new Date().toISOString(),
      }));
    }
    if (Array.isArray(parsed)) return parsed as StarredUser[];
    return [];
  } catch {
    return [];
  }
}

export function saveStarredUsers(users: StarredUser[]) {
  localStorage.setItem(STARRED_USERS_KEY, JSON.stringify(users));
}

export function getStarredUserIds(): Set<string> {
  return new Set(getStarredUsers().map((u) => u.id));
}

export function toggleStarredUser(userId: string): StarredUser[] {
  const users = getStarredUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx >= 0) {
    users.splice(idx, 1);
  } else {
    users.push({ id: userId, note: '', tag: '标杆案例', starredAt: new Date().toISOString() });
  }
  saveStarredUsers(users);
  return users;
}

export function updateStarredUserNote(userId: string, note: string): StarredUser[] {
  const users = getStarredUsers();
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.note = note;
    saveStarredUsers(users);
  }
  return users;
}

export function updateStarredUserTag(userId: string, tag: StarTag): StarredUser[] {
  const users = getStarredUsers();
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.tag = tag;
    saveStarredUsers(users);
  }
  return users;
}

export function removeStarredUser(userId: string): StarredUser[] {
  const users = getStarredUsers().filter((u) => u.id !== userId);
  saveStarredUsers(users);
  return users;
}
