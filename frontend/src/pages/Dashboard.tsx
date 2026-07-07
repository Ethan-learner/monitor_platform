import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { roleMenus, type MenuItem } from '../config/menus';
import IframeView from '../components/IframeView';
import { useEffect } from 'react';

function findItemByKey(items: MenuItem[], key: string): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findItemByKey(item.children, key);
      if (found) return found;
    }
  }
}

function findFirstLeaf(items: MenuItem[]): MenuItem | undefined {
  for (const item of items) {
    if (item.url) return item;
    if (item.children) {
      const found = findFirstLeaf(item.children);
      if (found) return found;
    }
  }
}

export default function Dashboard() {
  const { menuKey } = useParams<{ menuKey: string }>();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || menuKey) return;
    const first = findFirstLeaf(roleMenus[user.role]?.menus || []);
    if (first) navigate(`/dashboard/${first.key}`, { replace: true });
  }, [user, menuKey, navigate]);

  if (!user) return null;

  const menus = roleMenus[user.role]?.menus || [];
  const current = menuKey ? findItemByKey(menus, menuKey) : undefined;
  const target = current || findFirstLeaf(menus);

  if (!target || !target.url) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
        暂无可用看板
      </div>
    );
  }

  return <IframeView url={target.url} title={target.label} />;
}
