# uOttawa Calendar Generator

Automatically grabs your uOttawa schedule of the semester and populates your favourite electronic calendar (google calendar, iCloud calendar, etc.) with your courses.

**Still in development, should eventually be working on Windows CMD and *nix systems.**

## How to Install

###What You Need

1. <a href="https://nodejs.org/en/">Node.js (and NPM)</a>
  * parse the schedule's HTML, and interact with your linked Calendar(s) APIs
2. <a href="http://curl.haxx.se/">cURL</a>
  * HTTP GET and POST requests to get your schedule
3. <a href="https://www.cronofy.com/">Cronofy account</a>
  * one central API to talk to all different Calendars APIs

###Linux & Mac - not working yet, need to translate the batch into a shell script
1. **Node.js (and NPM)** <br>
  If you don't have it (to make sure, type `node -v` and `npm -v`), you can download it <a href="https://nodejs.org/en/download/">from here</a>, or via your favourite command-line package manager.

2. **cURL** <br>
  cURL should already be installed. To test, open your terminal and type:
  ```
  curl -h
  ```
  If you get a list of types of commands (and not a message saying **curl** is not defined), you're good! <br>
  If not, then <a href="http://curl.haxx.se/download.html">go here</a>, search for the *Mac OS X* section - or your *Linux* distro - download it and decompress it, or install it via your favourite command-line package manager. **You must install a version with SSL enabled**.
3. **Cronofy account** <br>
  Once you have signed up and are on the dashboard, click on `Create a personal access token` => `Choose calendar service to link` and   link it with your calendar provider. Now, you should get a personal token: copy it, and store it in an `environment variable` with the   key `cronofy_token`. To store an `environment variable`: <br>
```
  export cronofy_token=THE_TOKEN_YOU_COPIED_HERE
```
If you wish to erase it at a later time, simply type:
```
  unset cronofy_token
```

###Windows
1.  Use `git` to download the repository or download it as a zip file and decompress it. **Don't move the files relative to each other!**
2. **Node.js (and NPM)** <br>
  If you don't have it (to make sure, type `node -v` and `npm -v`), you can download it <a href="https://nodejs.org/en/download/">from here</a>.

3. **cURL** <br>
  cURL isn't installed by default, compared to Linux and Mac. To test if you have it, open your `cmd` and type:
  ```
  curl -h
  ```
  If you get a list of types of commands (and not a message saying **curl** is not defined), you're good! <br>
  If not, then <a href="http://curl.haxx.se/download.html">go here</a>, search for the *Windows* section, download it and decompress it. **You must install a version with SSL enabled**.
4. **Cronofy account** <br>
  Once you have signed up and are on the dashboard, click on `Create a personal access token` => `Choose calendar service to link` and   link it with your calendar provider. Now, you should get a personal token: copy it, and store it in an `environment variable` with   the   key `cronofy_token`. To store   an `environment variable`:
```
 set cronofy_token=THE_TOKEN_YOU_COPIED_HERE
```
If you wish to erase it at a later time, simply type:
```
 set cronofy_token=
```

When that's done, open your `cmd`, go to the directory where you installed the repo, and write `run`. Then, follow the instructions in your terminal :)






