const socket = io();

let formElm = document.querySelector("#chatForm");
console.log(formElm);
let msgInput = document.querySelector("#newMessage");
console.log(msgInput);

// LISTEN FOR NEWLY TYPES MESSAGES, 
// SEND THEM TO THE SERVER
formElm.addEventListener("submit", newMessageSubmitted);

function newMessageSubmitted(event){
    console.log(event);
    //stop form element from refreshing the page
    event.preventDefault();

    let newMessage = msgInput.value
    console.log(newMessage);

    appendMessage(newMessage);
    // Send the newMessage to the server 1st
    socket.emit("message", newMessage);
    
    // clear out input
    msgInput.value = "";

}

// LISTEN FOR NEW MESSAGES FROM SERVER
// APPEND THEM TO THE MESSAGE BOX
// AUTO SCROLL TO BOTTOM
socket.on("newMessage", function(data){
    console.log(data);
})

// APPEND MESSAGES TO BOX
function appendMessage(txt){
    console.log(txt);
    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");
    console.log(chatThreadList);

    // create new list item (li)
    let newListItem = document.createElement("li");
    newListItem.innerText = txt;

    // append new li to the list
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox
    chatThreadList.srollTop = chatThreadList.scrollHeight;
}

appendMessage("llaalalal");
// OPTIONAL: LISTEN FOR NEW NAME
// SEND IT TO SERVER


// window.addEventListener("resize", function(e){
//     console.log("resixed", window.innerHeight, e)
//     document.querySelector(".main-wrapper").style.height = "100dvh";
// })