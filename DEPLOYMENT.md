# 🚀 Deployment Guide

This survey application is designed for **static hosting** and can be deployed to various platforms. Here are the most common deployment options:

## 📋 Prerequisites

- All files are client-side (HTML, CSS, JavaScript)
- No server-side processing required
- No build step necessary
- Works with any static hosting provider

## 🌐 Deployment Options

### Option 1: GitHub Pages (Free)

**Setup:**
1. Push your code to a GitHub repository
2. Go to repository **Settings** → **Pages**
3. Set **Source** to "Deploy from a branch"
4. Select **Branch**: `main` and **Folder**: `/ (root)`
5. Click **Save**

**Your site will be available at:**
`https://[username].github.io/[repository-name]/`

**Features:**
- ✅ Free hosting
- ✅ Custom domains supported
- ✅ Automatic deploys on push
- ✅ GitHub Actions workflow included (`.github/workflows/deploy.yml`)

### Option 2: Netlify (Free Tier)

**Method A: Git Integration**
1. Connect your GitHub repository to Netlify
2. Set **Build command**: (leave empty)
3. Set **Publish directory**: `.` (root)
4. Deploy

**Method B: Drag & Drop**
1. Zip your entire project folder
2. Drag and drop to Netlify dashboard
3. Done!

**Your site will be available at:**
`https://[random-name].netlify.app` (customizable)

**Features:**
- ✅ Free tier with generous limits
- ✅ Custom domains
- ✅ Form handling (if needed later)
- ✅ Edge functions support
- ✅ Netlify configuration included (`netlify.toml`)

### Option 3: Vercel (Free Tier)

**Setup:**
1. Connect GitHub repository to Vercel
2. No build configuration needed
3. Deploy

**Features:**
- ✅ Excellent performance
- ✅ Global CDN
- ✅ Custom domains

### Option 4: Firebase Hosting

**Setup:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🔧 Configuration Files Included

Your project includes deployment configuration for multiple platforms:

- **`netlify.toml`** - Netlify configuration with redirects and headers
- **`.github/workflows/deploy.yml`** - GitHub Actions for automated deployment
- **`_config.yml`** - GitHub Pages configuration
- **`index.html`** - Root landing page with survey links

## 🌍 URL Structure

After deployment, your survey will be accessible at:

- **Landing page**: `https://yoursite.com/`
- **Survey app**: `https://yoursite.com/public/?uuid=participant-id`
- **Demo survey**: `https://yoursite.com/public/?uuid=demo-user`

## 🎯 Testing Your Deployment

1. **Visit the landing page** to ensure it loads
2. **Click "Demo Survey"** to test the full flow
3. **Complete a survey** and verify:
   - Questions display correctly
   - Timing data is captured
   - Feedback shows properly
   - JSON download works
4. **Test with different UUIDs** in the URL

## 📱 Mobile Compatibility

The survey is fully responsive and works on:
- ✅ Desktop browsers
- ✅ Mobile phones
- ✅ Tablets
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)

## 🔍 Troubleshooting

### Common Issues:

**1. CORS Errors**
- Ensure you're accessing via the deployed URL, not `file://`
- Check that JSON files are being served correctly

**2. 404 Errors**
- Verify all file paths are correct
- Check that item bank files exist in `/item-banks/`

**3. JavaScript Module Errors**
- Ensure your hosting supports ES modules
- Check browser console for specific errors

**4. Survey Not Loading**
- Check browser console for errors
- Verify JSON files are valid (use the linter: `python3 scripts/lint-bank.py`)

### Debug Mode:

Add `?debug=true` to any URL to enable verbose console logging:
`https://yoursite.com/public/?uuid=test&debug=true`

## 🔄 Updating Your Deployment

### GitHub Pages:
Just push to your main branch - automatic deployment via GitHub Actions

### Netlify:
- **Git integration**: Push to connected branch
- **Manual**: Drag & drop new files to dashboard

### Vercel:
Push to connected branch for automatic deployment

## 📊 Analytics & Monitoring

To track survey usage, you can add:
- Google Analytics
- Plausible Analytics  
- Custom event tracking in the JavaScript

Add tracking code to `public/index.html` before the closing `</head>` tag.

## 🛡️ Security Considerations

Since this is a client-side application:
- ✅ No server vulnerabilities
- ✅ No database security concerns
- ⚠️ All code is visible to users
- ⚠️ Consider data privacy for survey responses

## 📈 Performance Optimization

The app is already optimized for static hosting:
- ✅ Minimal dependencies (jQuery + SurveyJS from CDN)
- ✅ Compressed JSON files
- ✅ Efficient ES modules
- ✅ Cache headers configured (Netlify)

---

## 🚀 Quick Deploy Commands

**GitHub Pages:**
```bash
git add .
git commit -m "Deploy survey app"
git push origin main
```

**Netlify CLI:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

**Vercel CLI:**
```bash
npm install -g vercel
vercel --prod
```

Your survey is now ready for the world! 🌍
