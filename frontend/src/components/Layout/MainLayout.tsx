import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Typography } from 'antd';
import {
  BarChartOutlined, DashboardOutlined, DatabaseOutlined, DesktopOutlined,
  ApiOutlined, AlertOutlined, FileTextOutlined, LogoutOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ExportOutlined, CloudOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { roleMenus, type MenuItem } from '../../config/menus';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const iconMap: Record<string, React.ReactNode> = {
  BarChartOutlined: <BarChartOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  DesktopOutlined: <DesktopOutlined />,
  ApiOutlined: <ApiOutlined />,
  AlertOutlined: <AlertOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  CloudOutlined: <CloudOutlined />,
};

function toAntdItems(items: MenuItem[]): any[] {
  return items.map((item) => {
    const hasChildren = item.children && item.children.length > 0;
    return {
      key: item.key,
      icon: iconMap[item.icon] || <DashboardOutlined />,
      label: (
        <span>
          {item.label}
          {item.external && <ExportOutlined style={{ fontSize: 11, marginLeft: 4, color: '#999' }} />}
        </span>
      ),
      children: hasChildren ? toAntdItems(item.children!) : undefined,
    };
  });
}

function findLeafKey(items: MenuItem[]): string | null {
  for (const item of items) {
    if (item.url || item.native) return item.key;
    if (item.children) {
      const found = findLeafKey(item.children);
      if (found) return found;
    }
  }
  return null;
}

function findParentKeys(items: MenuItem[], targetKey: string): string[] {
  for (const item of items) {
    if (item.key === targetKey) return [item.key];
    if (item.children) {
      const found = findParentKeys(item.children, targetKey);
      if (found.length) return [item.key, ...found];
    }
  }
  return [];
}

function findItemByKey(items: MenuItem[], key: string): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findItemByKey(item.children, key);
      if (found) return found;
    }
  }
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const config = roleMenus[user.role];
  const menus = config?.menus || [];
  const antdItems = toAntdItems(menus);

  const menuKeyFromPath = location.pathname.replace('/dashboard/', '');
  const defaultLeafKey = findLeafKey(menus) || '';
  const currentKey = menuKeyFromPath || defaultLeafKey;
  const openKeys = findParentKeys(menus, currentKey).slice(0, -1);

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = findItemByKey(menus, key);
    if (item?.external && item?.url) {
      window.open(item.url, '_blank');
      return;
    }
    navigate(`/dashboard/${key}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuItems = [
    { key: 'role', label: `角色: ${config?.name || user.role}` },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        theme="dark"
        width={220}
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: collapsed ? 16 : 18, fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          {collapsed ? 'MP' : '统一监控门户'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          defaultOpenKeys={openKeys}
          items={antdItems}
          onClick={handleMenuClick}
          style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', overflowX: 'hidden' }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px', background: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 9,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && handleLogout() }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ fontSize: 18 }} />
              <Text>{user.displayName}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 0, minHeight: 'calc(100vh - 64px)', background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
