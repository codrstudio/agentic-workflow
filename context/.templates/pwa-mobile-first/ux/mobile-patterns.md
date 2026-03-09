# Mobile-First Patterns

Padroes de UX para interfaces mobile-first com React.

---

## PRINCIPIOS

1. **Touch targets**: Minimo 44x44px para botoes
2. **Thumb zone**: Acoes principais na parte inferior
3. **Gestos**: Swipe, pull-to-refresh, long-press
4. **Feedback haptico**: Vibracoes em acoes importantes
5. **Offline-first**: Estados de erro e retry

---

## LAYOUT MOBILE

### Bottom Navigation
```
┌─────────────────────┐
│                     │
│      CONTENT        │
│                     │
├─────────────────────┤
│ 🏠  📋  💬  👤     │  ← Fixed bottom
└─────────────────────┘
```

### Sheet Actions (ao inves de modais)
```tsx
// shadcn Drawer para mobile
<Drawer>
  <DrawerTrigger>Opcoes</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>Acoes</DrawerHeader>
    {/* Lista de acoes */}
  </DrawerContent>
</Drawer>
```

### Pull to Refresh
```tsx
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const { containerRef, isRefreshing } = usePullToRefresh({
  onRefresh: async () => {
    await refetchData();
  }
});
```

---

## GESTOS COMUNS

| Gesto | Acao | Implementacao |
|-------|------|---------------|
| Swipe left | Deletar item | Framer Motion drag |
| Swipe right | Arquivar/Marcar | Framer Motion drag |
| Long press | Menu contextual | onPointerDown + timer |
| Pull down | Refresh | Custom hook |
| Pinch | Zoom | touch-action: pinch-zoom |

### Swipe to Delete
```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: 0 }}
  onDragEnd={(_, info) => {
    if (info.offset.x < -80) onDelete();
  }}
>
  <div className="bg-destructive absolute right-0 h-full flex items-center px-4">
    <Trash2 />
  </div>
  <div className="bg-background relative z-10">
    {content}
  </div>
</motion.div>
```

---

## BREAKPOINTS

```css
/* Tailwind defaults */
sm: 640px   /* Celulares grandes */
md: 768px   /* Tablets portrait */
lg: 1024px  /* Tablets landscape / Desktop pequeno */
xl: 1280px  /* Desktop */
2xl: 1536px /* Desktop grande */
```

### Pattern: Mobile-first com fallback
```tsx
// Mobile: Sheet, Desktop: Dialog
const isMobile = useMediaQuery("(max-width: 768px)");

return isMobile ? (
  <Sheet>{content}</Sheet>
) : (
  <Dialog>{content}</Dialog>
);
```

---

## TOUCH FEEDBACK

### Ripple effect
```css
.touch-ripple {
  position: relative;
  overflow: hidden;
}

.touch-ripple::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  transform: scale(0);
  opacity: 0;
}

.touch-ripple:active::after {
  transform: scale(2);
  opacity: 1;
  transition: transform 0.3s, opacity 0.3s;
}
```

### Haptic feedback (PWA)
```tsx
const hapticFeedback = (type: "light" | "medium" | "heavy") => {
  if ("vibrate" in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    navigator.vibrate(patterns[type]);
  }
};
```

---

## PERFORMANCE MOBILE

1. **Virtualizacao**: React Virtual para listas longas
2. **Lazy loading**: Imagens e componentes pesados
3. **Skeleton**: Feedback imediato enquanto carrega
4. **Optimistic UI**: Atualizar antes da resposta do server

### Lista virtualizada
```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
});
```

---

## COMPONENTES SHADCN PARA MOBILE

| Componente | Uso Mobile |
|------------|------------|
| Drawer | Substitui Dialog em mobile |
| Sheet | Paineis laterais |
| Command | Busca global |
| Tabs | Navegacao em contexto |
| Carousel | Galeria swipeable |
| Scroll Area | Scroll suave |
