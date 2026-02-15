const links = [
  "https://maps.app.goo.gl/8EStr2fmnDrkK5TAA",
  "https://maps.app.goo.gl/Wp4NvR984HCcqWLu9",
  "https://maps.app.goo.gl/TwjPEj3qeik2hDn49",
  "https://maps.app.goo.gl/Y4pyoEtUozgRJ5sS6",

  "https://maps.app.goo.gl/zDzhogRBovURyMkL8",
  "https://maps.app.goo.gl/BYew9wHizKNNQKnC6",
  "https://maps.app.goo.gl/iGKHpBgBYbAjgb767",

  "https://maps.app.goo.gl/MNWuoBActB16Lhrw8",
  "https://maps.app.goo.gl/1o5tgT22DZQ1tEK78",
  "https://maps.app.goo.gl/fhBvnjKxH6tLSyrq5",
  "https://maps.app.goo.gl/Rd5fvrKLt4YZosMG9",
];

async function testAll() {
  let success = 0;
  let failed = 0;
  let totalTime = 0;

  const globalStart = Date.now();

  for (const url of links) {
    const start = Date.now();

    try {
      const res = await fetch("http://localhost:3000/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      const duration = Date.now() - start;
      totalTime += duration;

      if (data.latitude && data.longitude) {
        console.log(`✅ ${url}`);
        console.log(`⏱ Time: ${duration} ms`);
        console.log(`📍 Lat: ${data.latitude} | Lon: ${data.longitude}`);
        console.log("----------------------------------");
        success++;
      } else {
        console.log(`❌ ${url}`);
        console.log(`⏱ Time: ${duration} ms`);
        console.log("Không có lat/lon");
        console.log("----------------------------------");
        failed++;
      }

    } catch (err) {
      const duration = Date.now() - start;
      totalTime += duration;

      console.log(`🔥 LỖI: ${url}`);
      console.log(`⏱ Time: ${duration} ms`);
      console.log(err.message);
      console.log("----------------------------------");
      failed++;
    }
  }

  const globalDuration = Date.now() - globalStart;

  console.log("\n===== TỔNG KẾT =====");
  console.log("Có lat/lon:", success);
  console.log("Không có:", failed);
  console.log("Tổng thời gian:", globalDuration, "ms");
  console.log("Trung bình mỗi request:", Math.round(totalTime / links.length), "ms");
}

testAll();
