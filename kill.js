import { exec } from "child_process";

// Function to parse elapsed time (etime) and convert it to seconds
function parseElapsedTime(etime) {
  const match = etime.match(/^(\d+)-(\d{2}):(\d{2}):(\d{2})$/); // days-hh:mm:ss
  if (match) {
    const days = parseInt(match[1], 10);
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    const seconds = parseInt(match[4], 10);
    return days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds; // Total seconds
  }

  const shortMatch = etime.match(/^(\d{2}):(\d{2}):(\d{2})$/); // hh:mm:ss
  if (shortMatch) {
    const hours = parseInt(shortMatch[1], 10);
    const minutes = parseInt(shortMatch[2], 10);
    const seconds = parseInt(shortMatch[3], 10);
    return hours * 60 * 60 + minutes * 60 + seconds; // Total seconds
  }

  const simpleMatch = etime.match(/^(\d{2}):(\d{2})$/); // mm:ss
  if (simpleMatch) {
    const minutes = parseInt(simpleMatch[1], 10);
    const seconds = parseInt(simpleMatch[2], 10);
    return minutes * 60 + seconds; // Total seconds
  }

  const minuteMatch = etime.match(/^(\d{2})$/); // mm
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10) * 60; // Convert to seconds
  }

  return 0; // Default value for unknown formats
}

// Function to get the uptime of a process on macOS and kill if > 10 minutes
function getProcessUptimeAndKill(processNames) {
  console.clear(); // Clear the terminal for each new log output

  // Log the current time
  console.log(`Now: ${new Date().toLocaleString()}`);

  let killedProcesses = [];
  let processCounts = {};

  // Initialize processCounts for each browser
  processNames.forEach((processName) => {
    processCounts[processName] = { total: 0, killed: 0 };
  });

  // Iterate over all browser names and fetch their respective processes
  processNames.forEach((processName) => {
    const command = `ps -eo pid,etime,command`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error fetching process uptime: ${stderr}`);
        return;
      }

      // Filter the processes manually by matching the process name
      const processes = stdout
        .trim()
        .split("\n")
        .filter((line) =>
          line.toLowerCase().includes(processName.toLowerCase()),
        )
        .map((line) => {
          const [pid, etime, ...cmd] = line.trim().split(/\s+/);
          return { pid, etime, command: cmd.join(" ") };
        });

      const totalProcesses = processes.length;
      processCounts[processName].total = totalProcesses;

      // Check each process, and kill if uptime is greater than 10 minutes (600 seconds)
      processes.forEach((process) => {
        const uptimeInSeconds = parseElapsedTime(process.etime);

        if (uptimeInSeconds > 150) {
          // 600 seconds = 10 minutes
          exec(
            `kill -9 ${process.pid}`,
            (killError, killStdout, killStderr) => {
              if (killError) {
                // console.error(`Error killing process: ${killStderr}`);
                return;
              }

              // Store killed process details for later summary
              processCounts[processName].killed += 1;
              killedProcesses.push(
                `Kill ${processName} with uptime ${process.etime}`,
              );
            },
          );
        }
      });

      // Logging the count of processes for this browser
      if (processCounts[processName]) {
        const killedCount = processCounts[processName].killed;
        const killedLog = killedCount > 0 ? killedCount : "-";
        console.log(`${processName}: ${totalProcesses}, Killed: ${killedLog}`);
      }

      // // Logging the killed processes after all browsers are checked
      // if (processCounts[processName].killed > 0) {
      //     console.log("Killed:");
      //     killedProcesses.forEach(killed => {
      //         console.log(`- ${killed}`);
      //     });
      // } else {
      //     console.log("Killed: -");
      // }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Set an interval to check every 30 seconds (30000 milliseconds)
const interval = 30000; // Adjust this value for a different interval

const browsers = ["chromium", "brave", "opera", "firefox"]; // List of browsers to monitor

async function main() {
  while (true) {
    getProcessUptimeAndKill(browsers); // Monitor all browsers in the list
    await sleep(interval);
  }
}

main().catch(console.error);
