var socket = new WebSocket("ws://localhost:8080");

let testMessage = {
    action: "Test Action",
    payload: {
        data1: "Test Data 1",
        data2: "Test Data 2"
    }
};

socket.onopen = function (event) {
    socket.send(JSON.stringify(testMessage));
};

socket.onmessage = function (event) {
    console.log("Received message from server: ", JSON.parse(event.data));
};