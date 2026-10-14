<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NB Auto Downloader</title>
  <style>
    body {
      width: 280px;
      padding: 15px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #11131e;
      color: #ffffff;
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      border-bottom: 1px solid #2a2e45;
      padding-bottom: 10px;
    }
    .header img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
    }
    .header h3 {
      margin: 0;
      font-size: 16px;
      color: #00d2ff;
    }
    .field-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 11px;
      color: #a0a5c0;
      margin-bottom: 4px;
    }
    input[type="text"], select {
      width: 100%;
      padding: 8px;
      background: #1e2238;
      border: 1px solid #343a5e;
      border-radius: 6px;
      color: #fff;
      box-sizing: border-box;
      font-size: 12px;
    }
    .checkbox-group {
      display: flex;
      gap: 12px;
      margin-bottom: 15px;
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      font-size: 12px;
      color: #fff;
    }
    button {
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    #downloadBtn {
      background: #00d2ff;
      color: #000;
    }
    #monitorBtn {
      background: #2ecc71;
      color: #fff;
    }
    #resetBtn {
      background: #34495e;
      color: #fff;
    }
    #status {
      margin-top: 10px;
      font-size: 11px;
      color: #00d2ff;
      text-align: center;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="icon.png" alt="Logo">
    <h3>NB Auto Downloader</h3>
  </div>

  <div class="field-group">
    <label for="folderInput">Save Folder (inside Downloads):</label>
    <input type="text" id="folderInput" placeholder="GoogleFlow_Media">
  </div>

  <div class="checkbox-group">
    <label><input type="checkbox" id="dlVideos" checked> Videos (.mp4)</label>
    <label><input type="checkbox" id="dlImages" checked> Images (.webp)</label>
  </div>

  <div class="field-group">
    <label for="intervalSelect">Check Interval:</label>
    <select id="intervalSelect">
      <option value="2000">Every 2 Seconds</option>
      <option value="3000" selected>Every 3 Seconds</option>
      <option value="5000">Every 5 Seconds</option>
      <option value="10000">Every 10 Seconds</option>
    </select>
  </div>

  <button id="downloadBtn">Download Current Page</button>
  <button id="monitorBtn">Start Auto Monitoring</button>
  <button id="resetBtn">Reset History / Clear Log</button>

  <div id="status">Status: Ready</div>

  <script src="popup.js"></script>
</body>
</html>
