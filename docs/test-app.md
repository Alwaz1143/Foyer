1. Authentication
Test	What to do
Sign in	Open the app, sign in with email/password (or Google)
Sign out	Click avatar → Sign Out
First-time visitor	Open in incognito or cleared storage
2. Category CRUD
Test	What to do
Add section	Click "+ Add Section", enter name "Test"
Rename	Click section header → edit name
Reorder	Drag section by its header
Delete section	Delete the "Test" section
Add shortcut	Click "+" in a section, enter name + URL
Edit shortcut	Click edit on a shortcut, change name
Delete shortcut	Click delete on a shortcut
Drag shortcut	Drag shortcut to another section
3. Bookmark Import
Test	What to do	Expected
Upload HTML	Export bookmarks from browser → upload the HTML file	Preview table shows bookmarks with titles, folders, categories, confidence badges
Category override	In preview table, change category dropdown for a bookmark	Override is tracked
Staged import	Check "Only auto-import high-confidence matches"	High confidence imports immediately; rest go to pending review
Folder auto-create	Import bookmarks with folder names, check auto-create	Sections created from folder names (if ≥2 bookmarks per folder)
Done summary	Confirm import	Shows "Added X, skipped Y, created sections"
Pending badge	Avatar shows red badge dot with count	Badge number matches pending count
4. Pending Bookmark Review
Test	What to do	Expected
Open review	Click the pending badge on avatar	"Review Uncategorized Apps" modal opens
Confirm one	Select a category, click "Add"	Bookmark added to section, badge count decreases
Skip one	Click "Skip"	Bookmark removed, badge count decreases
Confirm All	Click "Confirm All"	All with selected category get added
Skip All	Click "Skip All"	All pending removed
5. Widgets
Test	What to do	Expected
Clock widget	Should appear (enabled by default)	Shows current time
Calendar widget	Should appear	Shows current month grid
Weather widget	Should appear	Shows temp, condition, forecast
News widget	Should appear	Shows headlines (may be empty if RSS feeds fail — shows "No headlines available" or retry button)
Search widget	Should appear	Search bar works
Toggle widgets	Open settings → uncheck a widget	Widget disappears
Re-enable widget	Check it again	Reappears
6. Wallpaper
Test	What to do	Expected
Wallpaper loads	Refresh page with wallpaper enabled	Background image loads
Toggle wallpaper	Settings → toggle wallpaper off	Background disappears
Re-enable	Toggle back on	New wallpaper loads
Unsplash connect (optional)	Click heart on wallpaper → connect Unsplash	OAuth flow works; heart button saves to Foyer collection
7. Extension
Test	What to do	Expected
Sign in	Open extension popup → sign in	Shows current tab info
Add page	Click "Add to Foyer"	Bookmark added to dashboard
Pending flow	Bookmark a page with low-confidence category	Extension shows pending confirmation UI
Confirm pending	Pick category → Confirm	Bookmark saved
Sync all	Click sync button	All bookmarks from browser sync to Foyer
Badge count	Extension icon shows badge number	Matches pending count
8. Settings Persistence
Test	What to do	Expected
Refresh	Toggle widgets, refresh page	Settings persist
Sign out/in	Sign out, sign back in	All categories + settings restored from Firestore
Cross-device	Make a change, wait ~30s, check another tab	Change syncs (polling interval)
9. Error/Edge Cases
Test	What to do	Expected
Error boundary	(Hard to trigger — but test by checking it's present)	If a component crashes, shows "Something went wrong" + Reload button
Offline (if possible)	Go offline, interact with app	Existing data still visible from cache; toast or error state shown for failed fetches
Retry widget	Wait for weather/news to fail (turn off network), check UI	Shows error icon + "Retry" button
Invalid bookmark URL	Import a bookmarks file with malformed URLs	Skips gracefully, no crash