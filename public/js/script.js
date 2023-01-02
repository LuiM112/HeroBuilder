document.querySelector(".searchHero").addEventListener("click",searchHero);

async function searchHero(){
  let teamId = this.id;
  document.querySelector("#heroInfo").innerHTML = " ";
  let hero = document.querySelector("#hero").value;
  let url = `https://www.superheroapi.com/api.php/106240675658920/search/${hero}`
  let response = await fetch(url);
  let data = await response.json();
  if(data.response == "error"){
    document.querySelector("#heroInfo").innerHTML = " ";
  }
  else{
    for(let i = 0; i < data.results.length; i++){
      document.querySelector("#heroInfo").innerHTML += `<div id="row"><div id="info"><img id="heroImage" src="${data.results[i].image.url}"><h2 id="heroName">${data.results[i].name}</h2></div><div id="heroStats"><br><br>Combat:${data.results[i].powerstats.combat} durability:${data.results[i].powerstats.durability} Intelligence:${data.results[i].powerstats.intelligence}<br> Power:${data.results[i].powerstats.power} Speed:${data.results[i].powerstats.speed} Strength:${data.results[i].powerstats.strength}</div><div><form action="/addHero?id=${data.results[i].id}&teamId=${teamId}" method="POST"><button><img src="/images/addPow.png" style="height:75px;"></button></form></div></div><br><br>`;
    }
  }
}