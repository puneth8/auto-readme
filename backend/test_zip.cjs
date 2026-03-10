const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const JSZip = require('jszip');

async function runTest() {
  const zip = new JSZip();
  zip.file("hello.txt", "Hello World");
  const zipBuffer = await zip.generateAsync({type: "nodebuffer"});
  
  const form = new FormData();
  form.append('projectZip', zipBuffer, {
    filename: 'test.zip',
    contentType: 'application/zip',
  });

  try {
    const res = await axios.post('http://localhost:5000/api/generate/zip', form, {
      headers: form.getHeaders(),
    });
    console.log("SUCCESS");
    console.log(res.data);
  } catch (e) {
    console.error("FAILED");
    if (e.response) {
      console.error(e.response.status);
      console.error(e.response.data);
    } else {
      console.error(e.message);
    }
  }
}

runTest();
