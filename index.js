const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const express = require('express')
const multipart = require('connect-multiparty')
const multipartMiddleware = multipart({ uploadDir: './uploads' })
const nodemailer = require('nodemailer')
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2')

// Server Configuration
const app = express()
const port = 3000

function setCorsHeaders(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE')
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
}
app.use(cors())
app.use(setCorsHeaders)
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// AWS Configuration
const sesClient = new SESv2Client({
    region: process.env.REGION,
    credentials: {
        secretAccessKey: process.env.ACCESS_KEY,
        accessKeyId: process.env.KEY_ID
    }
})

// Email Configuration
const path = require('path')
const validFileTypes = ['.doc', '.docx', '.pdf', '.rtf', '.txt']
const transporter = nodemailer.createTransport({
    SES: { sesClient, SendEmailCommand }
})

// Paths
app.get('/', (req, res) => {
    res.send('The email server is running.')
})

// Message Formatting
function getSubject(req) {
    return `CONTACT FORM: ${req.body.messageTitle}`
}

function getMessage(req) {
    return `From: ${req.body.name}\nEmail: ${req.body.email}\nMessage:\n\n${req.body.messageContent}`
}

function getAttachment(req) {
    var attachedFile = []
    if (req.files.uploads) {
        var filePath = req.files.uploads[0].path
        var fileName = req.files.uploads[0].name
        attachedFile.push({
            filename: fileName,
            path: filePath
        })
    }
    return attachedFile
}

// Cleanup
function checkForValidAttachment(attachment) {
    var extension = path.extname(attachment[0].path).toLowerCase()
    var isValid = validFileTypes.includes(extension)

    if (isValid)
        return true
    else {
        deleteAttachmentFromServer(attachment)
        return false
    }
}

function deleteAttachmentFromServer(attachment) {
    if (attachment.length == 0)
        return
    
    var filePath = attachment[0].path
    fs.unlink(filePath, (error) => {
        if (error)
            console.log(error)
        else
            console.log(`Uploaded file ${filePath} was deleted.`)
        console.log('------------------')
    })
}

// Paths
app.post('/send', multipartMiddleware, (req, res) => {
    var subject = getSubject(req)
    var message = getMessage(req)
    var attachment = getAttachment(req)

    if (attachment.length > 0) {
        if (!checkForValidAttachment(attachment)) {
            res.send(415)
            return
        }
    }

    transporter.sendMail({
        from: process.env.EMAIL,
        to: [process.env.EMAIL],
        subject: subject,
        text: message,
        attachments: attachment
    }, function(error, info) {
        if (error) {
            res.send(460)
            console.log(error)
        } else {
            res.send(200)
            console.log(`Sent email: ${info.response}`)
        }
        console.log('------------------')

        deleteAttachmentFromServer(attachment)
    })
})


// Start Server
app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})