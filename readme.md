# AMP *mass importer*
## Requirements
- Node.JS
- NPM
- A steady and reliable internet connection

## Usage
1. Create the import CSV file ([example](example.csv))
2. Install the dependencies via NPM
```bash
$ npm update
```
3. Copy the [example credentials file](credentials.js.dist) to the same directory
and name the new file credentials.js. Then edit the information inside (API keys, etc.)  
4. Go to the script folder and run the script
```bash
$ node ./run.js "/path/to/the/import/file.csv"
```

## How it works
This script will first retreive all the existing metaproperties and create
the missing one.

Then each file is pushed to the S3 endpoint. We notify Bynder when the upload is done. 

We have to poll every minute or so to verify if the file has been correctly uploaded.

If anything goes wrong during this process, the erroneous `job_id` is written 
in an `error.log` file. If it works the `job_id` is written into a `success.log` file.

**If a job_id is found inside the success.log, it won't be reuploaded**
 
 

