$(function() {
  var socket = io();
  var wizard = $('#wizard');
  
  wizard.steps({
    headerTag: "h3",
    bodyTag: "section",
    transitionEffect: "slideLeft",
    enablePagination: false,
    autoFocus: true,
    forceMoveForward: true,
    onInit: function() {
      wizard.fadeIn('slow')
    }
  });
  
  $('.submit [role=submit]').click(handleFormSubmission);
  $('.form input').keypress(handleFormSubmission);
  
  $('#colourPicker').on('show.bs.modal', function(e) {
    var courseType = $(e.relatedTarget).data('type'), currColour = $(e.relatedTarget).data('colorid');
    
    $('#colourPicker').data('type', courseType).find('.modal-body .chosen-colour').removeClass('picked');
    $('.colour-id-' + currColour, '#colourPicker .modal-body').addClass('picked');
  });
  $('#colourPicker .modal-body .chosen-colour').click(function() {
    var courseType = $('#colourPicker').data('type'), newColour = $(this).data('colorid');
    
    $('.course-colour.' + courseType + ' button').data('colorid', newColour).siblings('.chosen-colour').removeClass().addClass('chosen-colour colour-id-' + newColour);
    $('#colourPicker').modal('hide');
  });
  
  socket.on('grab semesters', function(data) {
    $('#wizard .content').removeClass('pre-loader');
    $('#wizard .content > section').eq(1).show();
    setTimeout(toastr.clear, 2000);
    
    if (!data)
      return toastr.error('', 'No semesters found...', {timeOut: 0})
      
    Object.keys(data).forEach(function(semester) {
      var semesterHTML = '<div class="checkbox">' +
                          '<label>' +
                            '<input type="checkbox" value="' + data[semester] + '">' + semester +
                          '</label>' +
                         '</div>';
      
      $('#semesters').append(semesterHTML);
    })
  })
  
  socket.on('grab schedules', function(data) {
    console.log(data)
  })
  
  
  // Object {Spring/Summer 2016: "active", Winter 2016: "previous", Fall 2016: "20169", Winter 2017: "20171"}
  
  
  
  /* functions */
  function handleFormSubmission(e) {
    var currIndex = e.type === "keypress" && e.keyCode == 13 ?
      $(this).parents('section').find('.submit button').data('index') :
      $(this).data('index');

    if (currIndex === 0) {
      var username = $('#uozoneUsername').val();
      var password = $('#uozonePassword').val();
        
      if (!username || !password) {
        signalError(currIndex, 'At least one field is incomplete...');
        return false;
      }
          
      verifyCredentials(username, password, function(ok) {
        if (ok) {
          wizard.steps('next');
          toastr.success('', 'Good credentials!')
          $('#wizard .content').addClass('pre-loader')
          $('#wizard .content > section').eq(1).hide()
          toastr.info('', 'Grabbing semesters...', {timeOut: 0})
        } else {
          signalError(currIndex, 'Bad credentials...');
        }
      })
    } else if (currIndex === 1) {
      var chosenSemesters = [];
      
      $('#semesters').find('input:checked').each(function() {
        chosenSemesters.push([$(this).parent().text().trim(), $(this).val()]); // push [key, val] pair
      })
 
      if (Object.keys(chosenSemesters).length === 0) {
        signalError(currIndex, 'Choose at least one semester...')
      } else {
        socket.emit('choose semesters', chosenSemesters, function(ok) {
          if (!ok) {
            signalErrors(currIndex, 'Chosen semesters not stored')
          } else {
            wizard.steps('next');
            toastr.success('', 'Semesters chosen stored!');
          }
        })
      }
    } else if (currIndex === 2) {
      var chosenColours = {};
      chosenColours['lecture'] = $('.course-colour.lecture button').data('colorid');
      chosenColours['dgd'] = $('.course-colour.dgd button').data('colorid');
      chosenColours['lab'] = $('.course-colour.lab button').data('colorid');
      
      console.log(chosenColours);
      // TODO: socket.emit
      // TODO: callback show courses, ask confirmation to generate
    }
  }
  
  function verifyCredentials(username, password, callback) {
    $('#loader').fadeIn(300);
    
    // change with real method
    socket.emit('verify credentials', {username, password}, function(status) {
      $('#loader').fadeOut(300);
      callback(status);
    })
  }
  
  function signalError(ind, errMessage) {
    wizard.find(".steps li").eq(ind).addClass("error");
    toastr.error('', errMessage)
  }
  
  
  /* options */
  toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "2000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  }
});
