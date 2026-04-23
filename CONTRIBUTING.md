# Contributing & Development

## Development Setup

### Prerequisites
- Node.js 16+
- Supabase account
- Git (optional)

### Local Development

```bash
# 1. Clone/open project
cd badminton-app

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with Supabase credentials

# 4. Start dev server
npm run dev

# 5. Open http://localhost:5173
```

## Project Structure

```
src/
├── components/      # Reusable UI components
├── contexts/        # React contexts (Auth)
├── lib/             # Utilities & API
├── pages/           # Page components
├── App.jsx          # Router setup
├── main.jsx         # Entry point
└── index.css        # Global styles
```

## Code Style

### Component Template
```jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button, Card } from '../components'

export const MyComponent = ({ prop1, prop2 }) => {
  const [state, setState] = useState(null)

  useEffect(() => {
    // Load data
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <p>{state}</p>
        <Button onClick={() => setState(true)}>Click</Button>
      </Card>
    </motion.div>
  )
}
```

### Naming Conventions
- Components: `PascalCase` (HomePage.jsx)
- Functions: `camelCase` (handleSubmit)
- Constants: `UPPER_SNAKE_CASE` (INITIAL_STATE)
- CSS Classes: `kebab-case` (primary-button)

## Adding New Features

### 1. New Page

```jsx
// src/pages/NewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, BottomNav } from '../components'

export const NewPage = () => {
  const navigate = useNavigate()
  
  return (
    <div className="pb-24">
      <Header title="New Page" />
      
      <div className="container-mobile py-6">
        {/* Content */}
      </div>
      
      <BottomNav />
    </div>
  )
}
```

Then add to `App.jsx`:

```jsx
import { NewPage } from './pages'

<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

### 2. New API Function

```js
// In src/lib/api.js
export const newFunction = async (param1, param2) => {
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('column', value)
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}
```

### 3. New Component

```jsx
// src/components/NewComponent.jsx
import clsx from 'clsx'

export const NewComponent = ({ children, variant = 'primary', ...props }) => {
  return (
    <div className={clsx('base-styles', variant && 'variant-styles')} {...props}>
      {children}
    </div>
  )
}
```

Then export in `src/components/index.js`.

## Testing

### Manual Testing Checklist

**Authentication**
- [ ] Sign up with valid email
- [ ] Email verification required
- [ ] Password validation works
- [ ] Login after verification
- [ ] Session persists on refresh
- [ ] Logout works

**Teams**
- [ ] Create team
- [ ] Join team (if applicable)
- [ ] View team members
- [ ] Change member role

**Events**
- [ ] Create event
- [ ] List events
- [ ] View event detail
- [ ] Check-in participant
- [ ] Add expense
- [ ] Approve expense

**Payments**
- [ ] Add payment info
- [ ] View settlement
- [ ] Make payment
- [ ] Payment status updates

**Mobile**
- [ ] Use Chrome DevTools device toolbar
- [ ] Test on actual phone if possible
- [ ] Check touch interactions
- [ ] Verify responsive layout

### Browser DevTools

```
F12 → Console: Check for errors
     → Network: Check API calls
     → Application: Check localStorage
     → Elements: Inspect CSS
```

## Performance Tips

1. **Avoid Unnecessary Renders**
   ```jsx
   // Use React.memo for expensive components
   export const MyComponent = React.memo(({ prop }) => {
     return <div>{prop}</div>
   })
   ```

2. **Lazy Load Components**
   ```jsx
   import { lazy, Suspense } from 'react'
   const HeavyComponent = lazy(() => import('./Heavy'))
   
   <Suspense fallback={<Loading />}>
     <HeavyComponent />
   </Suspense>
   ```

3. **Optimize Animations**
   - Use `will-change` CSS class
   - Limit number of animated elements
   - Use `GPU-accelerated` properties (transform, opacity)

4. **API Optimization**
   - Use `select()` to get only needed columns
   - Add `.limit()` to queries
   - Cache results when possible

## Debugging

### Enable Debug Logging

```js
// In lib/api.js
const DEBUG = true

export const getEvents = async (teamId) => {
  if (DEBUG) console.log('Fetching events for team:', teamId)
  // ... rest of function
  if (DEBUG) console.log('Got events:', data)
}
```

### Check React State

```jsx
// Add state logging
useEffect(() => {
  console.log('State updated:', { user, events, loading })
}, [user, events, loading])
```

### Check API Responses

```jsx
try {
  const data = await getEvents(teamId)
  console.table(data) // Pretty print in table format
} catch (error) {
  console.error('Error details:', error)
}
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "feat: add new feature"

# Push branch
git push origin feature/new-feature

# Create Pull Request on GitHub
# After review, merge to main
```

## Deployment Checklist

- [ ] All tests pass
- [ ] No console errors
- [ ] All features working
- [ ] Mobile responsive
- [ ] Environment variables set
- [ ] Build succeeds: `npm run build`
- [ ] No broken links
- [ ] Styling looks good
- [ ] Animations smooth
- [ ] Database connected

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint

# Cleanup
rm -rf node_modules
npm install

# Check Node version
node --version          # Should be 16+
npm --version
```

## Resources

- **React**: https://react.dev
- **Vite**: https://vitejs.dev
- **Tailwind**: https://tailwindcss.com
- **Supabase**: https://supabase.com/docs
- **Framer Motion**: https://www.framer.com/motion
- **React Router**: https://reactrouter.com

## Code Review Checklist

Before submitting code:
- [ ] Code follows style guide
- [ ] No console errors/warnings
- [ ] Mobile responsive
- [ ] Animations smooth
- [ ] No hardcoded values
- [ ] Error handling implemented
- [ ] Comments for complex logic
- [ ] No unused imports
- [ ] Tests pass

## Questions?

- Check documentation files
- Review existing code patterns
- Check Supabase logs
- Use browser DevTools
- Check TROUBLESHOOTING.md

---

Happy coding! 🚀
