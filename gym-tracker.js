// ===========================================
// USER CONFIGURATION SECTION
// ===========================================

// Step 1: Set the activity type you're tracking
const ACTIVITY_NAME = "Gym Tracker"; // customize this per Tracker
const STORAGE_FILE = `${ACTIVITY_NAME.toLowerCase()}_activity_progress.json`;

// STEP 2: Set your custom start date
// Format: YYYY, MM-1, DD (Months are 0-indexed, January=0, December=11)
const START_DATE = new Date(2025, 1, 1); // Feb 1, 2025

// Step 3: Configure widget appearance
const BG_COLOR = "#242424";       // Widget background color
const BG_OVERLAY_OPACITY = 1;     // Background opacity (0-1)
// Color settings for dots
const COLOR_FILLED = new Color("#59dac7");         // Color for completed days
const COLOR_UNFILLED = new Color("#42615c");       // Color for missed days
const COLOR_FUTURE = new Color("#0f1313");         // Color for future days

// STEP 4: Layout and sizing settings
const PADDING = 12;          // Space around the edges of the widget
const CIRCLE_SIZE = 7.5;     // Size of the progress dots
const CIRCLE_SPACING = 3;    // Space between dots
const TEXT_SPACING = 8;      // Space between dot grid and text
const DOT_SHIFT_LEFT = 2;    // Adjust horizontal alignment
const YEAR_OFFSET = DOT_SHIFT_LEFT - 2;
const STREAK_OFFSET = 0;

// ===========================================
// CALCULATIONS AND CONSTANTS
// ===========================================

function calculateDaysToTrack(startDate) {
  const year = startDate.getFullYear();
  const lastDayOfYear = new Date(year, 11, 31); // December 31st
  const diffTime = lastDayOfYear.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include the start date
  return diffDays;
}

// Dynamically calculate days to track based on start date
const DAYS_TO_TRACK = calculateDaysToTrack(START_DATE);

// Set widget dimensions and layout calculations
const WIDGET_WIDTH = 360;
const AVAILABLE_WIDTH = WIDGET_WIDTH - (2 * PADDING);
const TOTAL_CIRCLE_WIDTH = CIRCLE_SIZE + CIRCLE_SPACING;
const COLUMNS = Math.floor(AVAILABLE_WIDTH / TOTAL_CIRCLE_WIDTH);

// Font settings
const MENLO_REGULAR = new Font("Menlo", 12);
const MENLO_BOLD = new Font("Menlo-Bold", 12);

// ===========================================
// MAIN SCRIPT EXECUTION
// ===========================================

// File management setup
let fm = FileManager.iCloud();
let dir = fm.documentsDirectory();
let path = fm.joinPath(dir, STORAGE_FILE);

// Make sure the data file exists (create if missing)
await ensureFile();

// Load existing data, or initialize
let data = JSON.parse(fm.readString(path) || "{}");
if (!data[ACTIVITY_NAME]) data[ACTIVITY_NAME] = {};

let today = getTodayKey();
let isInWidget = config.runsInWidget;

if (!isInWidget) {
  // =============== Manual Run: Just ask YES/NO ===============
  let didDoIt = await askActivityCompleted(ACTIVITY_NAME);

  data[ACTIVITY_NAME][today] = {
    completed: didDoIt
  };

  fm.writeString(path, JSON.stringify(data));
  console.log(
    `${didDoIt ? "✅" : "❌"} Marked ${ACTIVITY_NAME} as ${
      didDoIt ? "completed" : "NOT completed"
    } for ${today}.`
  );

  let widget = await createWidget(data[ACTIVITY_NAME], ACTIVITY_NAME);
  Script.setWidget(widget);
} else {
  // =============== Widget Run: Just display the widget ===============
  let widget = await createWidget(data[ACTIVITY_NAME], ACTIVITY_NAME);
  Script.setWidget(widget);
}

Script.complete();

// ===========================================
// FUNCTIONS
// ===========================================

/**
 * Ask user if they completed today's activity
 */
async function askActivityCompleted(activityName) {
  let alert = new Alert();
  alert.title = `Activity: ${activityName}`;
  alert.message = `Did you complete the task today?`;
  alert.addAction("✅");
  alert.addCancelAction("❌");
  let result = await alert.present();
  return result === 0;
}

/**
 * Get today's date in 'YYYY-MM-DD' format
 */
function getTodayKey() {
  let d = new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Format any Date object into 'YYYY-MM-DD'
 */
function getDateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Create a blank data file if it doesn't already exist
 */
async function ensureFile() {
  if (!fm.fileExists(path)) {
    fm.writeString(path, "{}");
  }
}

/**
 * Count total completed days
 */
function countCompletedDays(activityData) {
  let count = 0;
  for (let key in activityData) {
    if (activityData[key] && activityData[key].completed) {
      count++;
    }
  }
  return count;
}

/**
 * Build the widget layout and fill it with data
 */
async function createWidget(activityData, activityName) {
  const widget = new ListWidget();
  
  // Set background color
  const overlay = new LinearGradient();
  overlay.locations = [0, 1];
  overlay.colors = [
    new Color(BG_COLOR, BG_OVERLAY_OPACITY),
    new Color(BG_COLOR, BG_OVERLAY_OPACITY)
  ];
  widget.backgroundGradient = overlay;
  
  widget.setPadding(12, PADDING, 12, PADDING);

  // Create main grid container
  const gridContainer = widget.addStack();
  gridContainer.layoutVertically();

  const gridStack = gridContainer.addStack();
  gridStack.layoutVertically();
  gridStack.spacing = CIRCLE_SPACING;

  // Add colored dots
  generateDots(activityData, gridStack);

  widget.addSpacer(TEXT_SPACING);

  // Add footer with activity name and total count
  const footer = widget.addStack();
  footer.layoutHorizontally();

  const activityStack = footer.addStack();
  activityStack.addSpacer(YEAR_OFFSET);
  const activityText = activityStack.addText(activityName);
  activityText.font = MENLO_BOLD;
  activityText.textColor = new Color("#999999");

  // Calculate total count of completed days
  let count = countCompletedDays(activityData);
  const countLabel = `count = ${count}`;
  
  const textWidth = countLabel.length * 7.5;
  const availableSpace =
    WIDGET_WIDTH - PADDING * 2 - YEAR_OFFSET - activityText.text.length * 7.5;
  const spacerLength = availableSpace - textWidth + STREAK_OFFSET;

  footer.addSpacer(spacerLength);

  const countTextStack = footer.addStack();
  const countDisplay = countTextStack.addText(countLabel);
  countDisplay.font = MENLO_REGULAR;
  countDisplay.textColor = new Color("#999999");

  return widget;
}

/**
 * Generate the grid of activity dots (completed/missed/future)
 */
function generateDots(activityData, gridStack) {
  const todayKey = getTodayKey();
  const ROWS = Math.ceil(DAYS_TO_TRACK / COLUMNS);

  for (let row = 0; row < ROWS; row++) {
    const rowStack = gridStack.addStack();
    rowStack.layoutHorizontally();
    rowStack.addSpacer(DOT_SHIFT_LEFT);
    
    for (let col = 0; col < COLUMNS; col++) {
      const day = row * COLUMNS + col;
      if (day >= DAYS_TO_TRACK) continue;

      let date = new Date(START_DATE);
      date.setDate(date.getDate() + day);
      let key = getDateKey(date);

      if (new Date(key) < new Date(START_DATE)) continue;

      const circle = rowStack.addText("■");
      circle.font = Font.systemFont(CIRCLE_SIZE);

      if (key > todayKey) {
        circle.textColor = COLOR_FUTURE;
      } else {
        if (activityData[key] && activityData[key].completed) {
          circle.textColor = COLOR_FILLED;
        } else {
          circle.textColor = COLOR_UNFILLED;
        }
      }

      if (col < COLUMNS - 1) rowStack.addSpacer(CIRCLE_SPACING);
    }
  }
}
