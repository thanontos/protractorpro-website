var https = require("https");

function get(path, token, callback) {
  var options = {
    hostname: "api.github.com",
    path: path,
    method: "GET",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ProtractorPro"
    }
  };
  var req = https.request(options, function(res) {
    var data = "";
    res.on("data", function(c) { data += c; });
    res.on("end", function() { callback(null, res.statusCode, data); });
  });
  req.on("error", function(e) { callback(e); });
  req.end();
}

function redirect(url, token, callback) {
  var u = new URL(url);
  var options = {
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: "GET",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/octet-stream",
      "User-Agent": "ProtractorPro"
    }
  };
  var req = https.request(options, function(res) {
    callback(null, res.statusCode, res.headers["location"] || "");
    res.resume();
  });
  req.on("error", function(e) { callback(e); });
  req.end();
}

exports.handler = function(event, context, callback) {
  var token = process.env.GITHUB_TOKEN;
  var repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return callback(null, { statusCode: 500, body: "Missing env vars" });
  }

  get("/repos/" + repo + "/releases/latest", token, function(err, status, body) {
    if (err) {
      return callback(null, { statusCode: 502, body: "Request error: " + err.message });
    }
    if (status !== 200) {
      return callback(null, { statusCode: 502, body: "GitHub status " + status + " repo=" + repo });
    }

    var release;
    try { release = JSON.parse(body); } catch(e) {
      return callback(null, { statusCode: 502, body: "JSON parse error" });
    }

    var assets = release.assets || [];
    var asset = null;
    for (var i = 0; i < assets.length; i++) {
      if (assets[i].name.indexOf(".exe") !== -1) {
        asset = assets[i];
        break;
      }
    }

    if (!asset) {
      var names = assets.map(function(a) { return a.name; }).join(", ");
      return callback(null, { statusCode: 404, body: "No exe found. Assets: " + names });
    }

    redirect(asset.url, token, function(err2, status2, location) {
      if (err2) {
        return callback(null, { statusCode: 502, body: "Redirect error: " + err2.message });
      }
      if (!location) {
        return callback(null, { statusCode: 502, body: "No location header. Status: " + status2 });
      }
      callback(null, { statusCode: 302, headers: { "Location": location } });
    });
  });
};
