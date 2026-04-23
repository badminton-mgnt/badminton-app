# Troubleshooting Guide

## Common Issues & Solutions

### 1. Email Verification Issues

**Problem**: Email not received after signup
**Solutions**:
- Check spam/promotions folder
- Wait a few minutes (email can be slow)
- Check Supabase email settings:
  - Authentication → Email Templates → Check if enabled
- Try using a different email address
- Check browser console for errors

**Problem**: "Email not confirmed" error on login
**Solution**:
- Must verify email first
- Click link in verification email
- After verification, you can login

### 2. Environment Variables

**Problem**: White screen or "undefined" errors
**Solutions**:
```bash
# 1. Check .env file exists
# 2. Verify values are not empty
# 3. Check no quotes around values

# WRONG:
VITE_SUPABASE_URL="https://..."

# RIGHT:
VITE_SUPABASE_URL=https://...

# 3. Restart dev server after changing .env
npm run dev
```

**Problem**: Supabase connection errors
**Solution**:
- Double-check URL (should have .supabase.co)
- Double-check ANON_KEY (should be long string)
- Make sure project is active in Supabase dashboard
- Try copying credentials again

### 3. Database Issues

**Problem**: "42P01: relation 'users' does not exist"
**Solutions**:
1. Make sure you ran `schema.sql` in Supabase SQL Editor
2. Check all tables exist:
   - users ✓
   - teams ✓
   - team_members ✓
   - events ✓
   - expenses ✓
   - payments ✓
   - payment_info ✓

**Problem**: RLS policy errors (401/403)
**Solutions**:
1. User might not be in the team
2. Check RLS policies in Supabase
3. Check user_id matches correctly
4. Admin-only operations might need admin role

**Problem**: Trigger not creating user profile
**Solution**:
- Make sure `triggers.sql` was executed
- Check Supabase Functions → Database Functions
- Look for `handle_new_user` function

### 4. Login/Authentication

**Problem**: Always redirected to login
**Solution**:
```js
// Check if AuthProvider wraps entire app
// Check in App.jsx:
<Router>
  <AuthProvider>  {/* Must be here */}
    <Routes>
      ...
    </Routes>
  </AuthProvider>
</Router>
```

**Problem**: Session not persisting after refresh
**Solution**:
- Check browser localStorage is not disabled
- Check Supabase session settings
- Try incognito mode (rules out extensions)

**Problem**: Password validation too strict
**Solution**:
- Must have 8+ characters
- Must have uppercase letter (A-Z)
- Must have lowercase letter (a-z)
- Must have number (0-9)
- Must have special character (!@#$%etc)
- Example: `MyPass123!` ✓

### 5. Styling Issues

**Problem**: Tailwind styles not applying
**Solutions**:
```bash
# 1. Restart dev server
npm run dev

# 2. Check CSS file is imported in App.jsx
import './index.css'

# 3. Reinstall Tailwind
npm install -D tailwindcss

# 4. Check tailwind.config.js paths are correct
content: ["./src/**/*.{js,jsx}"]
```

**Problem**: Colors not showing
**Solution**:
- Check Tailwind colors are defined in `tailwind.config.js`
- Example: `bg-primary-400` should map to `#43A047`

### 6. Component Issues

**Problem**: Modal not opening/closing
**Solution**:
```jsx
// Make sure state is connected:
const [modalOpen, setModalOpen] = useState(false)

<Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
  {/* content */}
</Modal>

<button onClick={() => setModalOpen(true)}>Open</button>
```

**Problem**: BottomNav not showing
**Solution**:
- Add `pb-24` class to main content (padding for fixed nav)
- Check navbar component is imported
- Verify it's inside ProtectedRoute (not on login page)

### 7. Mobile Testing

**Problem**: App doesn't look right on mobile
**Solution**:
```
Chrome DevTools:
1. F12
2. Click phone icon (device toolbar)
3. Select device
4. Refresh page
```

**Problem**: Touch events not working
**Solution**:
- Use `onClick` not `onMouseDown`
- Use `onTouchEnd` for specific touch handling
- Test on actual device if possible

### 8. Performance

**Problem**: App slow to load
**Solutions**:
1. Check network tab in DevTools
2. Reduce unnecessary API calls
3. Check for N+1 queries
4. Use `React.memo` for expensive components

**Problem**: High CPU usage
**Solution**:
- Check for infinite loops
- Check animations not running constantly
- Use `motion.div` not plain div for animations

### 9. Build/Deploy

**Problem**: `npm run build` fails
**Solution**:
```bash
# 1. Check for errors in console
# 2. Check all imports are correct
npm run build 2>&1 | head -50

# 3. Try clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Problem**: Build succeeds but preview shows blank
**Solution**:
- Check dist/index.html is generated
- Check dist/index.html has correct script tags
- Try `npm run preview` to test locally

### 10. Git Issues

**Problem**: Changes not showing in GitHub Pages
**Solutions**:
1. Make sure workflow runs successfully
2. Check Actions tab in GitHub
3. Wait 1-2 minutes for GitHub Pages to update
4. Hard refresh: Ctrl+Shift+R
5. Check deployment settings point to `dist/` folder

## Browser Console Errors

### "Cannot read property 'id' of null"
- User not logged in
- Check ProtectedRoute wraps component

### "Reference Error: supabase is not defined"
- Check supabase.js import
- Check .env variables

### "Uncaught TypeError: Cannot read properties of undefined"
- Object doesn't exist
- Check API response structure
- Add null checks

## Development Tips

### 1. Check Supabase Logs
```
Supabase Dashboard → Logs → Edge Functions
Look for error messages
```

### 2. Use Console Logs
```js
// Add debug logging
console.log('User:', user)
console.log('Teams:', teams)
console.log('Events:', events)
```

### 3. Check Network Tab
```
DevTools → Network
Look for failed API calls
Check response body for errors
```

### 4. Use React DevTools
```
Install: React Developer Tools extension
Check component tree
Inspect props and state
```

### 5. Database Inspection
```
Supabase → Table Editor
View actual data
Check if data is created
Check foreign keys
```

## Still Stuck?

1. **Check Documentation**
   - README.md
   - QUICKSTART.md
   - API.md
   - SUPABASE_SETUP.md

2. **Check Console**
   - Browser DevTools F12
   - Network tab for API errors
   - Console tab for JS errors

3. **Check Supabase Dashboard**
   - Logs for backend errors
   - Table Editor for data issues
   - Authentication page for user issues

4. **Verify Setup**
   - Run through QUICKSTART.md again
   - Double-check all environment variables
   - Make sure all schema tables exist

5. **Common Issues Checklist**
   - [ ] .env file has correct values
   - [ ] Database schema created
   - [ ] Triggers created
   - [ ] Email auth enabled in Supabase
   - [ ] User email verified
   - [ ] npm dependencies installed
   - [ ] Dev server running
   - [ ] Browser not cached (hard refresh)

---

For more help, check:
- Supabase Docs: https://supabase.com/docs
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev
- Tailwind Docs: https://tailwindcss.com/docs
