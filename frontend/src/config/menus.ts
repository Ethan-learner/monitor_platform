export interface MenuItem {
  key: string
  label: string
  icon?: string
  url?: string
  native?: boolean
  hideHeader?: boolean
  external?: boolean
  children?: MenuItem[]
}

export interface RoleConfig {
  name: string
  menus: MenuItem[]
}

export const nativeMenuKeys = {
  overview: 'overview',
  alerts: 'alerts',
} as const

export const roleMenus: Record<string, RoleConfig> = {
  ops: {
    name: '运维人员',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', native: true },
      {
        key: 'system', label: '系统监控', icon: 'DashboardOutlined', children: [
          { key: 'prometheus', label: 'Prometheus', native: true },
          { key: 'vmselect', label: 'VictoriaMetrics', url: '/vmselect/select/0/prometheus/vmui/#/?g0.range_input=30m&g0.end_input=2026-07-07T07%3A21%3A41&g0.relative_time=last_30_minutes&g0.tab=0', hideHeader: true },
        ],
      },
      {
        key: 'host', label: '主机监控', icon: 'DesktopOutlined', children: [
          { key: 'linux-server', label: '服务器 Linux', url: '/grafana/d/Bkl9bBYik/linux?orgId=1&kiosk' },
          { key: 'windows-server', label: '服务器 Windows', url: '/grafana/d/Kdh0OoSGz/windows?orgId=1&kiosk' },
        ],
      },
      {
        key: 'db', label: '数据库监控', icon: 'DatabaseOutlined', children: [
          { key: 'pmm-overview', label: '总览', url: '/grafana/d/mysql-instance-overview/mysql-instances-overview?orgId=1&kiosk' },
          {
            key: 'mysql', label: 'MySQL', children: [
              { key: 'mysql-overview', label: 'Overview', url: '/grafana/d/mysql-instance-overview/mysql-instances-overview?orgId=1&kiosk' },
              { key: 'mysql-summary', label: 'Summary', url: '/grafana/d/mysql-instance-summary/mysql-instance-summary?orgId=1&kiosk' },
            ],
          },
          { key: 'pmm-qan', label: 'Query Analytics', url: 'https://172.16.10.99/pmm-ui/graph/d/pmm-qan/pmm-query-analytics?orgId=1&kiosk', external: true },
        ],
      },
      {
        key: 'apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot-transactions', label: 'Transactions', url: 'https://172.16.10.99:4020/transaction/average', hideHeader: true },
          { key: 'glowroot-errors', label: 'Errors', url: 'https://172.16.10.99:4020/error/messages', hideHeader: true },
          { key: 'glowroot-jvm', label: 'JVM', url: 'https://172.16.10.99:4020/jvm/gauges', hideHeader: true },
          { key: 'glowroot-config', label: 'Configuration', url: 'https://172.16.10.99:4020/config/general?agent-rollup-id=%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86%E9%83%A8::', hideHeader: true },
          { key: 'glowroot-admin', label: 'Administration', url: 'https://172.16.10.99:4020/admin/general', hideHeader: true },
        ],
      },
      {
        key: 'logs', label: '日志监控', icon: 'FileTextOutlined', children: [
          { key: 'loki', label: 'Loki 日志', url: '/grafana/a/grafana-lokiexplore-app/explore?from=now-1m&to=now&var-ds=cfid27mkbyvpcd&var-filters=&patterns=%5B%5D&var-primary_label=service_name%7C%3D~%7C.%2B&timezone=browser&var-lineFormat=&var-fields=&var-levels=&var-metadata=&var-jsonFields=&var-all-fields=&var-patterns=&var-lineFilterV2=&var-lineFilters=&var-filters_replica=&kiosk' },
        ],
      },
      {
        key: 'boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana', label: 'Grafana 首页', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
  dev: {
    name: '开发人员',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', native: true },
      {
        key: 'dev-apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot', label: 'Glowroot APM', url: 'https://172.16.10.99:4020' },
        ],
      },
      {
        key: 'dev-boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana-dev', label: 'Grafana 开发看板', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
  mgmt: {
    name: '管理层',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      {
        key: 'mgmt-boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana-mgmt', label: 'Grafana 概览', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
}
