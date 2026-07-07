export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  url?: string;
  children?: MenuItem[];
}

export interface RoleConfig {
  name: string;
  menus: MenuItem[];
}

export const roleMenus: Record<string, RoleConfig> = {
  ops: {
    name: '运维人员',
    menus: [
      {
        key: 'system', label: '系统监控', icon: 'DashboardOutlined', children: [
          { key: 'prometheus', label: 'Prometheus 联邦', url: 'http://172.16.10.27:9090' },
        ],
      },
      {
        key: 'host', label: '主机监控', icon: 'DesktopOutlined', children: [
          { key: 'linux-server', label: '服务器 Linux', url: '/api/proxy/grafana/d/Bkl9bBYik/linux?orgId=1&var-ds_prometheus=dfig10p6fvke8c&var-region=%E4%B8%8A%E6%B5%B7&var-department=%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86%E9%83%A8&var-project=BI&var-env=%E7%94%9F%E4%BA%A7&var-instance=BItest&var-maxmount=%2F&kiosk=tv' },
          { key: 'pmm', label: 'PMM 数据库监控', url: '/api/proxy/pmm' },
        ],
      },
      {
        key: 'apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot', label: 'Glowroot APM', url: 'http://172.16.10.27:4000' },
        ],
      },
      {
        key: 'overview', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana', label: 'Grafana 总览', url: '/api/proxy/grafana' },
        ],
      },
    ],
  },
  dev: {
    name: '开发人员',
    menus: [
      {
        key: 'dev-apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot', label: 'Glowroot APM', url: 'http://172.16.10.27:4000' },
        ],
      },
      {
        key: 'dev-grafana', label: 'Grafana', icon: 'BarChartOutlined', children: [
          { key: 'grafana-dev', label: 'Grafana 开发看板', url: '/api/proxy/grafana' },
        ],
      },
    ],
  },
  mgmt: {
    name: '管理层',
    menus: [
      {
        key: 'mgmt-grafana', label: 'Grafana 概览', icon: 'BarChartOutlined', children: [
          { key: 'mgmt', label: '看板总览', url: '/api/proxy/grafana' },
        ],
      },
    ],
  },
};
