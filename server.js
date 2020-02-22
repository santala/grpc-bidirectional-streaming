const async = require('async');
const fetch = require('node-fetch');

const PROTO_PATH = __dirname + '/urifetch.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    }
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const uriFetch = protoDescriptor.urifetch;

const port = 50051;

// SERVICE INTERFACE

const server = new grpc.Server();
server.bind('0.0.0.0:'+port, grpc.ServerCredentials.createInsecure());

function getContent(call, callback) {
    createResponse(call.request.uri).then(response => {
        callback(null, response);
    });
}

async function createResponse(uri) {
    try {
        const res = await fetch(uri);
        const body = await res.text();
        return {
            uri: uri,
            status: res.status,
            content: body
        };
    } catch (e) {
        console.log(e);
        return {
            uri: uri,
            status: 404,
            content: ''
        };
    }
}

function streamContent(call) {
    let shouldEnd = false;
    let requestsInProgress = 0;

    call.on('data', async (req) => {
        requestsInProgress += 1;
        const response = await createResponse(req.uri);
        call.write(response);

        requestsInProgress -= 1;
        if (shouldEnd && requestsInProgress == 0) {
            call.end();
        }
    });

    call.on('end', () => {
        // Close the connection from server-side only after all the results have been sent
        shouldEnd = true;
    });
}

server.addService(uriFetch.URIFetch.service, {
    getContent: getContent,
    streamContent: streamContent
});
server.start();


// CLIENT INTERFACE

const client = new uriFetch.URIFetch('localhost:'+port, grpc.credentials.createInsecure());

const express = require('express');
const app = express();

app.get('/get-content', function (req, res) {
    client.getContent({ uri: req.query.uri }, (err, uriContent) => {
        console.log(err, uriContent);
        if (err) {
            // process error
            res.send(uriContent);
        } else {
            // process feature
            res.send(uriContent);
        }
    });
});

app.get('/stream-content', function (req, res) {
    const call = client.streamContent();
    call.on('data', function(uriContent) {
        console.log('Received: ' + uriContent.uri);
    });

    [req.query.uri].forEach(uri => {
        call.write({ uri: uri });
    });

    call.end();
    res.send("Success");
});

app.listen(3000);
