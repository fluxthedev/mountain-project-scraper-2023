const LRU = require('lru-cache');
const Bottleneck = require('bottleneck');
const cheerio = require('cheerio');
const requestPromise = require('request-promise');
const { writeFile } = require('fs-extra');
const { gray, yellow } = require('chalk');

const INDENTATION = 2;

// Create a new cache with a maximum size of 500
const cache = new LRU(500);

// Create a new limiter with a maximum of 5 requests per second
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200,
});

// Request the given url, load content into cheerio parser, handle errors
function request(url) {
  // If the url is in the cache, return the cached value
  if (cache.has(url)) {
    return Promise.resolve(cache.get(url));
  }

  // Otherwise, make a new request
  return new Promise((resolve) => {
    limiter
      .schedule(() =>
        requestPromise({
          uri: url,
          transform: cheerio.load,
          headers: { Connection: 'Keep-Alive' },
        })
      )
      .then((data) => {
        process.stdout.write(gray('+'));
        // Store the result in the cache
        cache.set(url, data);
        return data;
      })
      .then(resolve)
      .catch((error) => {
        process.stdout.write(yellow('-'));
        console.error(
          `Error occurred while requesting ${url}: ${error.message}`
        );
        return request(url).then(resolve);
      });
  });
}

// Returns a promise that writes data to a file then resolves with the data
function writeDataToFile(jsonData, fileName) {
  console.log(`\nSaving data to ${fileName}...`);

  // Convert the JSON data to a string without indentation (minified)
  let string = JSON.stringify(jsonData);

  // Remove newline characters
  string = string.replace(/\n/g, '');

  // Write the string to the file
  return writeFile(fileName, string, 'utf8')
    .then(() => console.log(`Data saved!`))
    .then(() => jsonData);
}

// Logging helper for promise chains
function promiseLog(message) {
  return (value) => {
    console.log(message);
    return value;
  };
}

// Remove empty fields from an object
function purgeEmptyFields(obj) {
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    if (
      val === '' ||
      val === false ||
      val === undefined ||
      val === null
    ) {
      delete obj[key];
    }
  });
  return obj;
}

module.exports = {
  request,
  writeDataToFile,
  promiseLog,
  purgeEmptyFields,
};
