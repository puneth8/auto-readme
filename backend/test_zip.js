import AdmZip from 'adm-zip';

async function runTest() {
  const zip = new AdmZip();
  zip.addFile("hello.txt", Buffer.from("Hello World"));
  const zipBuffer = zip.toBuffer();
  
  const form = new FormData();
  form.append('projectZip', new Blob([zipBuffer], { type: 'application/zip' }), 'test.zip');

  try {
    const res = await fetch('http://localhost:5000/api/generate/zip', {
      method: 'POST',
      body: form
    });
    
    if (!res.ok) {
       const text = await res.text();
       console.error("FAILED", res.status);
       console.error(text);
    } else {
       console.log("SUCCESS");
       const json = await res.json();
       console.log(json);
    }
  } catch (e) {
    console.error("NETWORK ERROR");
    console.error(e.message);
  }
}

runTest();
