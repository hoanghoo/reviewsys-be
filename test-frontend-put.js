const http = require('http');

const data = JSON.stringify({
  fullName: "Phó phòng Test",
  position: "Phó phòng",
  roles: ["Manager"],
  teamId: 7,
  managedTeamIds: [1, 2]
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/teams/7/leader', // Wait, this requires authentication!
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log("Needs token, cannot test directly without it.");
