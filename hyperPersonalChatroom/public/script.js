const socket = io();

let formElm = document.querySelector("#chatForm");
console.log(formElm);
let msgInput = document.querySelector("#newMessage");
console.log(msgInput);

let nameInput = document.querySelector("#nameWrapper input");
let nameTag   = document.querySelector("#nameWrapper p");
let userName  = "";

nameInput.addEventListener("change", function(){
    let trimmed = nameInput.value.trim();
    if(!trimmed) return;
    userName = trimmed;
    nameInput.style.display = "none";
    nameTag.textContent = userName;

    // announcement
    let entryLi = document.createElement('li');
    entryLi.className = 'system';
    entryLi.textContent = userName + ' entered the chat';
    document.querySelector('#threadWrapper ul').appendChild(entryLi);
    socket.emit('message', entryLi.textContent);
});

// LISTEN FOR NEWLY TYPEd MESSAGES, 
// SEND THEM TO THE SERVER
formElm.addEventListener("submit", newMessageSubmitted);

function newMessageSubmitted(event){
    console.log(event);
    // stop form element from refreshing the page
    event.preventDefault();

    // must have a user name to send message
    if(!userName) return;  

    // message
    let newMessage = msgInput.value
    console.log(newMessage);

    appendMessage(newMessage);
    // send the newMessage to the server 1st
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
    newListItem.innerHTML = '<span class="who">' + userName + ':</span> <span class="words">' + txt + '</span>';

    // append new li to the list
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox
    chatThreadList.srollTop = chatThreadList.scrollHeight;
}