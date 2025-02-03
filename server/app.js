// Add this to your static file serving configuration
app.use('/fonts', express.static(path.join(__dirname, '../public/fonts'))); 