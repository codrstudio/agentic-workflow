# Anti-patterns de Hooks React

## 1. Hooks dentro de condicionais / loops

```jsx
// ❌ ERRADO
function Component({ isLoggedIn }) {
  if (isLoggedIn) {
    const [user, setUser] = useState(null); // crash garantido
  }
}

// ✅ CERTO — hook sempre no topo, condição dentro
function Component({ isLoggedIn }) {
  const [user, setUser] = useState(null);
  if (!isLoggedIn) return null;
}
```

React mantém hooks por **ordem de chamada**. Qualquer coisa que quebre a ordem = crash.

---

## 2. useEffect com dependency array errado

```jsx
// ❌ Array vazio mas usa props/state dentro
useEffect(() => {
  fetchData(userId); // userId muda, mas o effect não re-executa
}, []);

// ❌ Sem array — roda em todo render (loop infinito se tiver setState)
useEffect(() => {
  setCount(count + 1); // 💀 loop infinito
});

// ✅ Dependências corretas
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

---

## 3. Objeto/array como dependência do useEffect

```jsx
// ❌ Nova referência a cada render → loop infinito
const filters = { status: 'active' }; // recriado toda vez

useEffect(() => {
  fetchData(filters);
}, [filters]); // sempre diferente

// ✅ Primitivo ou useMemo
const filters = useMemo(() => ({ status: 'active' }), []);
// ou desestrutura direto
useEffect(() => {
  fetchData({ status });
}, [status]);
```

---

## 4. Função recriada causando loop

```jsx
// ❌ handleFetch é recriada todo render → useEffect loopa
const handleFetch = () => fetchData(id);

useEffect(() => {
  handleFetch();
}, [handleFetch]); // 💀

// ✅ useCallback ou move a função para dentro do effect
useEffect(() => {
  const handleFetch = () => fetchData(id);
  handleFetch();
}, [id]);
```

---

## 5. setState em componente desmontado

```jsx
// ❌ Async que termina depois do unmount
useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(data => setData(data)); // componente pode já ter desmontado
}, []);

// ✅ AbortController ou flag de cleanup
useEffect(() => {
  let cancelled = false;
  fetch('/api/data')
    .then(res => res.json())
    .then(data => { if (!cancelled) setData(data); });

  return () => { cancelled = true; };
}, []);
```

---

## 6. useCallback / useMemo desnecessário

```jsx
// ❌ Memoizar tudo sem critério — overhead sem ganho
const value = useMemo(() => a + b, [a, b]); // operação trivial
const fn = useCallback(() => console.log('hi'), []); // sem passar como prop

// ✅ Use quando: passar para filho com React.memo, ou em dependency array
```

---

## 7. Custom hook com lógica de render

```jsx
// ❌ Custom hook retornando JSX
function useModal() {
  return <div>Modal</div>; // não é hook, é componente disfarçado
}

// ✅ Hook retorna estado/comportamento, componente retorna JSX
function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
```

---

## 8. Derivar estado de props no useState

```jsx
// ❌ Estado que deveria ser derivado
function Component({ items }) {
  const [filteredItems, setFilteredItems] = useState(items.filter(...));
  // filteredItems fica stale quando items muda
}

// ✅ Calcular direto ou useMemo
function Component({ items }) {
  const filteredItems = useMemo(() => items.filter(...), [items]);
}
```

---

## Diagnóstico rápido dos seus crashes

| Sintoma | Provável causa |
|---|---|
| "Rendered more hooks than previous render" | Hook em condicional |
| Loop infinito / freeze | `useEffect` sem dep array ou objeto como dep |
| Dados desatualizados (stale) | Dep array incompleto |
| Warning "Can't update unmounted component" | setState após unmount |

Instala o plugin **eslint-plugin-react-hooks** — ele pega a maioria desses problemas em tempo de desenvolvimento.