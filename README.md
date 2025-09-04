# Avalanche Survey Prototype

A vanilla JavaScript SurveyJS-based survey application for avalanche education research. This prototype loads external item banks, randomizes testlets, captures timing data, provides grading feedback, and downloads responses as JSON files.

## 🚀 Quick Start

### Local Development

1. **Start the server**:
   ```bash
   ./start-server.sh
   ```
   Or manually:
   ```bash
   npx serve . -p 3000
   ```

2. **Open in browser**:
   - **Demo survey**: http://localhost:3000/public/
   - **With custom UUID**: http://localhost:3000/public/?uuid=PILOT1

### Production Hosting

This is a **static web application** that can be hosted on any static file server:

- **GitHub Pages**: Upload to a repository and enable Pages
- **Netlify**: Drag and drop the project folder
- **AWS S3**: Upload files and configure as static website
- **Any web server**: Serve the project root directory

**Requirements**: Only static file hosting - no server-side processing needed.

## 📋 Survey Flow

1. **Background Questions** (3 questions)
2. **AP Testlet Questions** (8 questions, randomized from 2 testlets)
3. **Diagnostic Questions** (3 questions)
4. **Feedback & Results** (graded with explanations)
5. **JSON Download** (complete response data with timing)

## ⚙️ Configuration

### Swapping Item Banks

To use different survey content:

1. **Replace item bank files** in `item-banks/`:
   - `background.json` - Background questionnaire
   - `bank.demo.json` - AP testlets and diagnostics
   - `config.demo.json` - Survey configuration

2. **Update environment** in `public/env.js`:
   ```javascript
   window.__SURVEY_CONFIG__ = {
     BACKGROUND_URL: "/item-banks/your-background.json",
     BANK_URL: "/item-banks/your-bank.json",
     CONFIG_URL: "/item-banks/your-config.json",
     TITLE: "Your Survey Title"
   };
   ```

3. **Validate your bank**:
   ```bash
   python3 scripts/lint-bank.py item-banks/your-bank.json
   ```

### Configuration Options

Edit `item-banks/config.demo.json`:

```json
{
  "routing": {
    "randomize_blocks": true,      // Randomize testlet order
    "blocks_to_draw": 2,           // Number of testlets to select
    "randomize_within_block": true, // Shuffle questions within testlets
    "include_diagnostics": true    // Include diagnostic questions
  },
  "ui": {
    "one_question_per_page": true, // One question per page
    "auto_advance": true,          // Auto-advance after answering
    "progress_bar": true           // Show progress bar at top
  },
  "quiz": {
    "feedback_mode": "full",       // "full" table or "summary" score only
    "show_explanations": true      // Include explanations in feedback
  }
}
```

## 🧪 Running Pilots

### For Participants

1. **Share the URL**: `https://your-domain.com/public/?uuid=PARTICIPANT_ID`
2. **Participants complete** the survey (auto-advance, ~5-10 minutes)
3. **JSON file downloads** automatically: `survey_PARTICIPANT_ID_timestamp.json`

### For Researchers

The downloaded JSON contains:

```json
{
  "ts": "2025-01-09T19:34:18.000Z",
  "uuid": "PARTICIPANT_ID", 
  "surveyVersion": "1.0.0",
  "bankVersion": "1.0.0",
  "data": {
    // All survey responses (background, AP questions, diagnostics)
    "primary_activity": "skiing",
    "storm_q1": "A",
    // ... all responses
    
    // Timing data (milliseconds)
    "rt_storm_q1_final": 3421,
    "rt_storm_q2_final": 2156,
    "idle_ms": 1250
    // ... timing for each question
  },
  "grading": {
    "totalItems": 8,
    "correctItems": 6, 
    "score": 75,
    "items": [
      // Detailed per-item results with correct answers and explanations
    ]
  }
}
```

### Data Analysis

- **Response data**: All participant answers in `data` object
- **Performance data**: Per-question response times (`rt_*_final`) and idle time
- **Grading data**: Correctness, scores, and detailed feedback per item
- **Metadata**: Timestamps, UUIDs, survey versions for tracking

## 🔧 Development

### Project Structure

```
/
├── public/                 # Static web assets
│   ├── index.html         # Main HTML page
│   ├── styles.css         # Custom styles
│   ├── env.js            # Environment configuration
│   └── env.example.js    # Environment template
├── src/                   # JavaScript modules
│   ├── main.js           # Application entry point
│   ├── builder.js        # Survey building logic
│   ├── feedback.js       # Grading and feedback
│   ├── instrumentation.js # Timing capture
│   └── logic.default.js  # Default survey logic
├── item-banks/           # Survey content
│   ├── background.json   # Background questions
│   ├── bank.demo.json    # AP testlets + diagnostics
│   └── config.demo.json  # Survey configuration
├── scripts/              # Validation tools
│   ├── lint-bank.py      # Python bank validator
│   └── lint-bank.mjs     # Node.js bank validator
└── src/schema/           # JSON schemas
    ├── bank.schema.json  # Item bank schema
    └── config.schema.json # Configuration schema
```

### Adding New Question Types

The system supports SurveyJS question types:
- `html` - Information/instructions
- `radiogroup` - Single choice
- `checkbox` - Multiple choice  
- `dropdown` - Select dropdown
- `comment` - Text input

Add new types by updating the schemas and testing with the linter.

### Custom Logic

Replace `src/logic.default.js` with custom logic:

```javascript
export default {
  onInit: (survey, config) => { /* Custom initialization */ },
  selectBlocks: (testlets, config) => { /* Custom testlet selection */ },
  selectItems: (items, config) => { /* Custom item selection */ },
  beforeRender: (survey) => { /* Pre-render customization */ },
  onGrade: (results, survey) => { /* Custom grading logic */ },
  onComplete: (survey, data) => { /* Custom completion handling */ }
};
```

## 🔮 Future Enhancements

### Backend Integration

To enable server-side data collection:

1. **Set SAVE_URL** in `public/env.js`:
   ```javascript
   SAVE_URL: "https://your-api.com/survey/save"
   ```

2. **The app will POST** survey data to this endpoint on completion

3. **Response format**:
   ```json
   {
     "method": "POST",
     "headers": { "Content-Type": "application/json" },
     "body": "{ /* complete survey data */ }"
   }
   ```

### BIB API Integration

For integration with existing research systems:

1. **Set QUOTA_ENDPOINT** in `public/env.js`
2. **Implement quota checking** before survey start
3. **Add participant management** and session tracking

### Advanced Features

- **Adaptive testing**: Adjust difficulty based on responses
- **Real-time analytics**: Dashboard for monitoring pilot progress  
- **Multi-language support**: Internationalization for global studies
- **Offline capability**: Service worker for unreliable connections

## 📊 Validation

### Item Bank Validation

```bash
# Python (recommended)
python3 scripts/lint-bank.py item-banks/bank.demo.json

# Node.js (if available)
node scripts/lint-bank.mjs item-banks/bank.demo.json
```

### Testing Checklist

- [ ] Survey loads without errors
- [ ] Background questions display correctly
- [ ] AP testlets randomize (refresh to verify)
- [ ] Questions advance automatically
- [ ] Progress bar shows and updates
- [ ] Grading feedback displays with correct scores
- [ ] JSON downloads with complete data
- [ ] Timing data captures per-question response times
- [ ] UUID parameter works: `?uuid=TEST123`

## 📄 License

This prototype is for research purposes. Modify and distribute as needed for educational research.

## 🤝 Contributing

1. Test with different item banks and configurations
2. Validate using the lint tools
3. Document any issues or enhancement requests
4. Follow the established project structure for new features

---

**Built with**: Vanilla JavaScript, SurveyJS, and modern web standards for maximum compatibility and performance.