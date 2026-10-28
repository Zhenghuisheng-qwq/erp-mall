import type { Component } from 'vue'
import { House, Goods, Grid, Connection, FolderOpened, Collection, Files, SetUp, Notebook, Filter, PriceTag, User, DataAnalysis, CircleCheck, Share, DocumentCopy, Upload, Operation, UserFilled, ChatDotRound, Setting, Document } from '@element-plus/icons-vue'

// Display-only route mapping. Menu titles, order, visibility and grouping remain owned by menuConfig.
const icons: Record<string, Component> = {
  '/guide': Notebook,
  '/': House, '/spus': Goods, '/skus': Grid,
  '/compatibility': Connection, '/categories': FolderOpened, '/product-types': Collection,
  '/templates': Files, '/models': Collection, '/specs': SetUp, '/params': Notebook,
  '/rules': Filter, '/brands': PriceTag, '/groups': User, '/overview': DataAnalysis,
  '/check': CircleCheck, '/tree': Share, '/plans': DocumentCopy, '/import': Upload,
  '/products?panel=columns': Operation, '/users': UserFilled, '/feedback': ChatDotRound,
  '/account': User, '/menus': Setting, '/roles': UserFilled, '/permissions': Connection,
}
export function menuRouteIcon(route: string): Component { return icons[route] || Document }
