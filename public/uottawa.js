$(function() {
  var socket = io();
  var wizard = $('#wizard');
  
  wizard.steps({
    headerTag: "h3",
    bodyTag: "section",
    transitionEffect: "slideLeft",
    enablePagination: false,
    autoFocus: true,
    onInit: function() {
      wizard.fadeIn('slow')
    }
  });
  
  $('.submit [role=submit]').click(function() {
    var currIndex = $(this).data('index');
    
    if (currIndex === 0) {
      var username = $('#uozoneUsername').val();
      var password = $('#uozonePassword').val();
        
      if (!username || !password) {
        signalError(currIndex);
        return false;
      }
          
      verifyCredentials(username, password, function(ok) {
        ok ?
          wizard.steps('next'):
          signalError(currIndex);
      })
    } else if (currIndex === 1) {

    } else {
      
    }
  })
  
  
  
  /* functions */
  function verifyCredentials(username, password, callback) {
    // change with real method
    setTimeout(function() {callback(true)}, 4000)
  }
  
  function signalError(ind) {
    wizard.find(".steps li").eq(ind).addClass("error");
  }
});
