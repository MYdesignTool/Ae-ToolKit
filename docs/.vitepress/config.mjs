import { defineConfig } from 'vitepress';

const repo = 'https://github.com/MYdesignTool/Ae-ToolKit';
const userSidebar = [
  { text: '开始使用', items: [
    { text: '普通用户指南', link: '/users/' },
    { text: '安装与更新', link: '/users/installation' }
  ] },
  { text: '日常工作', items: [
    { text: '工程整理', link: '/users/organizer' },
    { text: '批量表达式', link: '/users/expressions' },
    { text: '本地脚本集', link: '/users/scripts' }
  ] },
  { text: '维护与排查', items: [
    { text: '通用设置', link: '/users/settings' },
    { text: '数据与备份', link: '/users/backup' },
    { text: '常见问题', link: '/users/faq' }
  ] }
];
const developerSidebar = [{ text: '二次开发者', items: [
  { text: '开发入门', link: '/developers/' },
  { text: '架构与加载流程', link: '/developers/architecture' },
  { text: 'Host 桥接接口', link: '/developers/bridge' },
  { text: '数据与扩展约定', link: '/developers/data' },
  { text: '测试与构建', link: '/developers/testing' },
  { text: '维护使用文档', link: '/developers/documentation' }
] }];

export default defineConfig({
  lang: 'zh-CN',
  title: 'Ae-ToolKit 使用文档',
  description: '面向普通用户与二次开发者的 AE Local Toolkit 使用文档。',
  base: '/Ae-ToolKit/docs/',
  sitemap: { hostname: 'https://mydesigntool.github.io/Ae-ToolKit/docs/' },
  srcDir: './manual',
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/Ae-ToolKit/docs/logo.svg' }]],
  transformHead({ pageData }) {
    const canonical = 'https://mydesigntool.github.io/Ae-ToolKit/docs/' + pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '.html');
    return pageData.relativePath === '404.md' ? [] : [['link', { rel: 'canonical', href: canonical }]];
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Ae-ToolKit' },
    siteTitle: 'Ae-ToolKit 文档',
    nav: [
      { text: '文档首页', link: '/' },
      { text: '普通用户', link: '/users/', activeMatch: '/users/' },
      { text: '二次开发者', link: '/developers/', activeMatch: '/developers/' },
      { text: '返回官网', link: 'https://mydesigntool.github.io/Ae-ToolKit/?lang=zh', target: '_self' }
    ],
    sidebar: { '/users/': userSidebar, '/developers/': developerSidebar },
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: { locales: { root: { translations: {
        button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
        modal: { noResultsText: '未找到相关结果', resetButtonTitle: '清除搜索', displayDetails: '显示详细结果', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } }
      } } } }
    },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新', formatOptions: { dateStyle: 'medium' } },
    editLink: { pattern: repo + '/edit/main/docs/manual/:path', text: '在 GitHub 上编辑此页' },
    darkModeSwitchLabel: '切换主题',
    lightModeSwitchTitle: '切换至浅色主题',
    darkModeSwitchTitle: '切换至深色主题',
    sidebarMenuLabel: '文档目录',
    returnToTopLabel: '返回顶部',
    skipToContentLabel: '跳转到内容',
    notFound: { title: '页面未找到', quote: '这个文档页面可能已移动，请从文档首页继续浏览。', linkLabel: '返回文档首页', linkText: '返回文档首页' },
    footer: { message: '基于 VitePress 构建 · GPL v3.0', copyright: '© MYdesignTool' }
  }
});
