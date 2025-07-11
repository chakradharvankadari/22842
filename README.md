URL Shortener Microservice
A simple and lightweight Node.js + Express service that turns long, messy URLs into short, clean ones—with expiration and basic click stats.

Features
Quick URL Shortening: Auto-generated or custom shortcodes

Link Expiry: Control how long links remain valid (default: 30 mins)

Click Tracking: See how often a short URL is accessed

Custom Codes: Choose your own short and catchy code

Auto-Cleanup: Expired links get cleaned up regularly

Verbose Logging: Logs requests, errors, and performance data

Getting Started
Prerequisites
Node.js (v14+)

npm (comes with Node)

Installation
bash
Copy
Edit
# Clone the repo
git clone <repo-url>
cd url-shortener
npm install

# Run the server
npm start
By default, it runs at:
http://localhost:3000

API Usage
Shorten a URL
POST /shorturls

{
  "url": "https://example.com/very/long/path",
  "validity": 60,
  "shortcode": "custom123"
}
Parameters:

url (required): The full URL you want to shorten

validity (optional): Minutes before expiry (default is 30)

shortcode (optional): 3-20 character alphanumeric string

Response:
{
  "shortLink": "http://localhost:3000/custom123",
  "expiry": "2025-01-01T12:00:00.000Z"
}
Get Link Stats
GET /shorturls/:shortcode

Returns:
  Original URL
  Creation and expiry time
  Number of times clicked
{
  "shortcode": "custom123",
  "originalUrl": "https://example.com/very/long/path",
  "createdAt": "2025-01-01T11:00:00.000Z",
  "expiry": "2025-01-01T12:00:00.000Z",
  "accessCount": 12
}
How It Works
In-memory storage (cleared on restart)

Every 5 minutes, expired links are removed

Shortcodes are validated (3-20 alphanumeric characters)

Logs track every request and error in detail

Configuration
Set these as environment variables if needed:
PORT (default: 3000)

BASE_URL (default: http://localhost:3000)
>node apis.js
