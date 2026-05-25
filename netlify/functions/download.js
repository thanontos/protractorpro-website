// netlify/functions/download.js
const https = require("https");

function githubGet(path, token) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: "api.github.com",
      path: path,
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ProtractorPro-Netlify"
      }
    };
    var req = https.request(options, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function githubAssetRedirect(url, token) {
  return new Promise(function(resolve, reject) {
    var parsed = new URL(url);
    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/octet-stream",
        "User-Agent": "ProtractorPro-Netlify"
      }
    };
    var req = https.request(options, function(res) {
      resolve({ status: res.statusCode, location: res.headers["location"] || "" });
      res.resume();
    });
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async function() {
  var token = process.env.GITHUB_TOKEN;
  var repo  = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return { statusCode: 500, body: "Missing GITHUB_TOKEN or GITHUB_REPO env var." };
  }

  // 1. Get latest release
  var releaseRes;
  try {
    releaseRes = await githubGet("/repos/" + repo + "/releases/latest", token);
  } catch (err) {
    return { statusCode: 502, body: "GitHub request failed: " + err.message };
  }

  if (releaseRes.status !== 200) {
    return { statusCode: 502, body: "GitHub API status " + releaseRes.status + " for repo: " + repo };
  }

  var release;
  try {
    release = JSON.parse(releaseRes.body);
  } catch (err) {
    return { statusCode: 502, body: "Could not parse GitHub response." };
  }

  // 2. Find .exe asset
  var assets = release.assets || [];
  var asset = null;
  for (var i = 0; i < assets.length; i++) {
    if (assets[i].name.toLowerCase().indexOf(".exe") !== -1) {
      asset = assets[i];
      break;
    }
  }

  if (!asset) {
    var names = assets.map(function(a) { return a.name; }).join(", ") || "(none)";
    return { statusCode: 404, body: "No .exe in release " + release.tag_name + ". Assets: " + names };
  }

  // 3. Get CDN redirect URL
  var redirectRes;
  try {
    redirectRes = await githubAssetRedirect(asset.url, token);
  } catch (err) {
    return { statusCode: 502, body: "Asset redirect failed: " + err.message };
  }

  var cdnUrl = redirectRes.location;
  if (!cdnUrl) {
    return { statusCode: 502, body: "No redirect location. Asset status: " + redirectRes.status };
  }

  return {
    statusCode: 302,
    headers: { "Location": cdnUrl }
  };
};
