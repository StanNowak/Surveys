# Avalanche Canada Survey Project - Complete Summary

## 🎯 **Project Overview**

A fully functional survey application with **Avalanche Canada branding** and **optional backend integration**. Built using **SurveyJS** with **vanilla JavaScript** and includes a **Dockerized Postgres + PostgREST backend** for research data collection.

## 🏗️ **Architecture**

### **Frontend (Static Deployment Ready)**
- **Framework**: Vanilla JavaScript + SurveyJS (jQuery version)
- **Styling**: Custom CSS with Avalanche Canada branding (Navy blue + DM Sans font)
- **Deployment**: Static files compatible with GitHub Pages, Netlify, Vercel
- **Backend Mode**: Configurable (test mode = JSON download, prod mode = API calls)

### **Backend (Optional - Local Development)**
- **Database**: PostgreSQL 16
- **API**: PostgREST v12.2.0 (auto-generated REST API)
- **Deployment**: Docker Compose
- **Features**: Balanced Incomplete Block (BIB) design, stratified assignment, response storage

## 📁 **Key Files & Structure**

```
/Users/snowak/Prototypes/Surveys/
├── public/                          # Static web assets
│   ├── index.html                   # Main HTML page with Avalanche Canada header
│   ├── styles.css                   # Custom CSS with navy blue branding
│   ├── env.js                       # Main environment configuration
│   └── env.local.js                 # Local development overrides (localhost only)
├── src/                             # Application logic
│   ├── main.js                      # Entry point with backend integration
│   ├── builder.js                   # Survey construction from JSON schemas
│   ├── instrumentation.js           # Timing and interaction tracking
│   ├── logic.default.js             # Survey scoring and logic
│   └── feedback.js                  # Results display and JSON download
├── item-banks/                      # Survey content and configuration
│   ├── bank.demo.json               # Avalanche problems item bank
│   ├── config.demo.json             # Survey configuration
│   └── background.json              # Canadian backcountry experience questions
├── packages/backend/                # Dockerized backend (optional)
│   ├── docker-compose.yml           # Postgres + PostgREST containers
│   ├── db/init/                     # Database initialization scripts
│   │   ├── 001-core.sql             # Schema and tables
│   │   └── 002-rpc.sql              # RPC functions for BIB assignment
│   └── postgrest/                   # PostgREST configuration
└── studies/ap_v1/                   # Study-specific helpers
    ├── Makefile                     # Backend management commands
    └── runner.env.example.js        # Study configuration template
```

## 🎨 **Avalanche Canada Branding**

### **Visual Identity**
- **Header**: Navy blue (`#1e3a5f`) with mountain emoji and official branding
- **Typography**: DM Sans font throughout (loaded from Google Fonts)
- **Colors**: Navy blue for all titles, progress bars, and interactive elements
- **Layout**: Professional layout matching Avalanche Canada's website style

### **Content Customization**
- **Survey Title**: "Avalanche Canada - Avalanche Problems Research"
- **Background Questions**: Canadian backcountry experience context
- **Training Options**: CAA (Canadian Avalanche Association) terminology:
  - Avalanche Awareness (CAA)
  - AST 1/AST 2 (Avalanche Skills Training)
  - CAA Level 1/2 (Professional certifications)

## 🔧 **Backend Integration (M1-M3 Complete)**

### **Milestone M1**: Dockerized Backend ✅
- Postgres 16 + PostgREST v12.2.0 setup
- Schema `s_ap_v1` with tables: `responses`, `pair_counts`, `allocations`
- RPC functions: `assign_pair`, `submit_response`, `delete_by_uuid`, `export_ndjson`

### **Milestone M2**: Frontend Integration ✅
- Environment-based configuration (test/prod modes)
- Backend API calls with graceful fallbacks
- Experience band calculation: `novice`, `intermediate`, `advanced`
- Pair assignment based on Balanced Incomplete Block (BIB) design

### **Milestone M3**: Study Management ✅
- Study-specific configuration templates
- Makefile for backend management (`make up`, `make down`, `make smoke`)
- Smoke tests for API validation
- Documentation for local development workflow

### **Key Features**
- **Stratified Assignment**: Participants grouped by experience level
- **BIB Design**: Ensures balanced pair comparisons across strata
- **Graceful Degradation**: Falls back to JSON download if backend unavailable
- **Local-Only Backend**: Backend only active on localhost (static deploy safe)

## 🚀 **Deployment Options**

### **Static Deployment (Recommended)**
```bash
# GitHub Pages / Netlify / Vercel
# Just deploy the entire project folder
# Backend integration disabled by default
```

### **Local Development with Backend**
```bash
# 1. Start backend
cd packages/backend
cp postgrest/.env.example postgrest/.env
docker compose up -d

# 2. Start frontend
npx serve . -p 3000

# 3. Test backend
make -C studies/ap_v1 smoke
```

## 📊 **Data Collection**

### **Response Data Structure**
```json
{
  "uuid": "participant-identifier",
  "survey_id": "avalanche_canada_ap_v1", 
  "pair": ["problem_a", "problem_b"],
  "stratum": "novice|intermediate|advanced",
  "answers": { /* survey responses */ },
  "timings": { /* per-question response times */ },
  "panel_member": true,
  "bank_version": "1.0.0",
  "config_version": "1.0.0"
}
```

### **Backend Tables**
- **`responses`**: Complete survey responses with metadata
- **`pair_counts`**: BIB design tracking (stratified by experience)
- **`allocations`**: UUID → assigned pair mapping (prevents re-assignment)

## 🧪 **Testing & Validation**

### **Frontend Testing**
- Load survey: `http://localhost:3000/public/?uuid=test-user`
- Verify Avalanche Canada branding and DM Sans font
- Test background questions → pair assignment → completion flow

### **Backend Testing**
```bash
# Smoke tests
make -C studies/ap_v1 smoke

# Manual API testing
curl -s http://localhost:8787/rpc/assign_pair \
  -H 'Content-Type: application/json' \
  -d '{"p_uuid":"test","p_stratum":"novice","p_ap_list":["storm","wind","persistent","cornice"]}'
```

## 🔄 **Configuration Management**

### **Environment Variables**
- **`MODE`**: `"test"` (JSON download) or `"prod"` (API calls)
- **`SURVEY_ID`**: Study identifier (`"avalanche_canada_ap_v1"`)
- **`ASSIGN_URL`**: Backend pair assignment endpoint
- **`SAVE_URL`**: Backend response submission endpoint
- **`STRATUM_FROM_FIELD`**: Field for experience band calculation

### **Local Override Pattern**
- `public/env.js`: Safe defaults for static deployment
- `public/env.local.js`: Local development overrides (localhost only)
- Study-specific: `studies/ap_v1/runner.env.example.js`

## 🛡️ **Security & Privacy**

### **Data Protection**
- No PII in backend payloads (UUID-based identification)
- CORS configuration for production deployments
- EU hosting recommendations for GDPR compliance
- GDPR helper functions (`delete_by_uuid`, `export_ndjson`)

### **Static Deploy Safety**
- Backend URLs empty by default
- `env.local.js` only loads on localhost
- Production deployments remain client-side only

## 📚 **Documentation**

- **`README.feature-branch.md`**: Feature branch overview
- **`packages/backend/README.md`**: Backend setup and smoke tests  
- **`PROJECT-SUMMARY.md`**: This comprehensive summary
- **Inline comments**: Throughout codebase for maintenance

## 🎯 **Next Steps / Future Enhancements**

1. **Production Backend Deployment**: EU-hosted Postgres + PostgREST
2. **Advanced Analytics**: Response time analysis, completion rates
3. **Multi-Study Support**: Extend configuration for different research projects
4. **Mobile Optimization**: Responsive design improvements
5. **Accessibility**: WCAG compliance enhancements

## 🏁 **Project Status: COMPLETE**

✅ **Avalanche Canada branding implemented**  
✅ **Backend integration (M1-M3) complete**  
✅ **Static deployment ready**  
✅ **Local development workflow established**  
✅ **Documentation comprehensive**  

**Ready for research deployment! 🍁**
