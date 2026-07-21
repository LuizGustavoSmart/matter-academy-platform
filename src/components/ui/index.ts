/* ============================================================
   Matter Academy — Biblioteca de componentes (área autenticada)
   Ponto único de import: `import { … } from '../../components/ui'`.
   Mantém compatibilidade com os exports legados (Button, Card,
   Badge, Modal, Empty, ProgressBar, Toast).
   ============================================================ */
export { cn, initials, stringHue } from './util';

export {
  Spinner, Button, IconButton, Field,
  Input, Textarea, Select, SearchInput,
  Checkbox, Radio, Switch,
  Badge, Avatar, ProgressBar, Skeleton, SkeletonText,
} from './primitives';
export type { BtnProps, BtnVariant, BadgeTone } from './primitives';

export {
  Card, StatTile, EmptyState, Empty, Alert,
  Breadcrumbs, Tabs, Pagination, Tooltip, FilterChip,
} from './surfaces';
export type { Crumb } from './surfaces';

export {
  Modal, Drawer, DropdownMenu, ConfirmProvider, useConfirm,
  ToastProvider, useToast, Toast,
} from './overlays';
export type { MenuItem } from './overlays';

export { TableWrap, THead, TBody, Tr, Th, Td, SortHeader, TableSkeleton } from './table';
