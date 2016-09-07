$(function () {
	var socket = io();
	var wizard = $('#wizard');
	var schedulesParsed = false,
		selectionFinished = false; // two flags, both must be true to show final generation panel

	wizard.steps({
		headerTag: "h3",
		bodyTag: "section",
		transitionEffect: "slideLeft",
		enablePagination: false,
		autoFocus: true,
		onInit: function () {
			wizard.fadeIn('slow')
		}
	});

	$('.submit [role=submit]').click(handleFormSubmission);
	$('.form input').keypress(handleFormSubmission);
	$('.go-back').click(function() {
		wizard.steps('previous');
	});

	$('#colourPicker').on('show.bs.modal', function (e) {
		var courseType = $(e.relatedTarget).data('type'),
			currColour = $(e.relatedTarget).data('colorid');

		$('#colourPicker').data('type', courseType).find('.modal-body .chosen-colour').removeClass('picked');
		$('.colour-id-' + currColour, '#colourPicker .modal-body').addClass('picked');
	});
	$('#colourPicker .modal-body .chosen-colour').click(function () {
		var courseType = $('#colourPicker').data('type'),
			newColour = $(this).data('colorid');

		$('.course-colour.' + courseType + ' button').data('colorid', newColour).removeClass().addClass('btn bold colour-id-' + newColour);
		$('#colourPicker').modal('hide');
	});

	$('#schedule').on('click', 'button', function () {
		$(this).attr('disabled', true);

		socket.emit('generate schedule');
	});

	socket.on('grab semesters', function (data) {
		$('#wizard .content').removeClass('pre-loader');
		$('#wizard .content > section').eq(1).show();
		setTimeout(toastr.clear, 2000);

		if (!data)
			return toastr.error('', 'No semesters found...', {
				timeOut: 0
			})

		Object.keys(data).forEach(function (semester) {
			var semesterHTML = '<div class="checkbox">' +
				'<label>' +
				'<input type="checkbox" value="' + data[semester] + '">' + semester +
				'</label>' +
				'</div>';

			$('#semesters').append(semesterHTML);
		})
	})

	socket.on('grab schedules', function (data) {
		if (data.err)
			return toastr.error('', 'Problem while grabbing schedules...');

		toastr.info('', 'Schedules grabbed!');

		// populate
		populateScheduleTable(data.coursesInfo);

		if (selectionFinished) {
			$('#loader').fadeOut(300);
			promptGenerateView();
		} else {
			schedulesParsed = true;
		}
	});

	socket.on('inserted course', function (data) {
		var colourFeedback = data.ok ? 'green' : 'red';
		var glyphiconFeedback = data.ok ? 'glyphicon glyphicon-ok-circle' : 'glyphicon glyphicon-remove-circle';

		$('[id="' + data.course[0] + '"] [id="' + data.course[1] + '"] li').eq(data.course[2]).css({
			'color': colourFeedback,
			'font-weight': 'bold'
		}).append(' <span class="' + glyphiconFeedback + '"></span>');
	});

	socket.on('inserted all courses', function (ok) {
		ok ?
			toastr.success('', 'All courses are now in your calendar!', {
				timeOut: 0
			}) :
			toastr.error('', 'There was at least one error while inserting events to your calendar...', {
				timeOut: 0
			});
	})


	function promptGenerateView() {
		$('#schedule').fadeIn(500);

		$('html, body').animate({
			scrollTop: $("#schedule").offset().top - 10
		}, 1000);
	}

	function populateScheduleTable(data) {
		var tableContent = '';

		Object.keys(data).forEach(function (semester) {
			tableContent += '<div class="semester-table row" id="' + semester + '">';
			tableContent += '<h2>' + semester + '</h2>';

			var semesterObj = data[semester];
			Object.keys(semesterObj).forEach(function (course) {
				tableContent += '<div class="course-table col-xs-6" id="' + course + '">';
				tableContent += '<h3>' + course + '</h3>';
				tableContent += '<ul>';

				semesterObj[course].forEach(function (period) {
					tableContent += '<li>' + period + '</li>';
				})

				tableContent += '</ul>';
				tableContent += '</div>';
			});

			tableContent += '</div>';
		});

		tableContent += '<div class="text-center row generate-button"><button class="btn btn-primary btn-lg">Generate <span class="glyphicon glyphicon-ok"></span></button></div>';
		$('#schedule').html(tableContent);
	}


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

			verifyCredentials(username, password, function (ok) {
				if (ok) {
					wizard.steps('next');
					toastr.success('', 'Good credentials!')
					$('#wizard .content').addClass('pre-loader')
					$('#wizard .content > section').eq(1).hide()
					toastr.info('', 'Grabbing semesters...', {
						timeOut: 0
					})
				} else {
					signalError(currIndex, 'Bad credentials...');
				}
			})
		} else if (currIndex === 1) {
			var chosenSemesters = [];

			$('#semesters').find('input:checked').each(function () {
				chosenSemesters.push([$(this).parent().text().trim(), $(this).val()]); // push [key, val] pair
			})

			if (Object.keys(chosenSemesters).length === 0) {
				signalError(currIndex, 'Choose at least one semester...')
			} else {
				socket.emit('choose semesters', chosenSemesters, function (ok) {
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

			socket.emit('choose colours', chosenColours, function (ok) {
					if (!ok) {
						signalErrors(currIndex, 'Chosen colours not stored')
					} else {
						toastr.success('', 'Colours chosen stored!');

						if (schedulesParsed) {
							promptGenerateView();
						} else {
							selectionFinished = true;
							$('#loader').fadeIn(300);
						}
					}
				})
				// TODO: socket.emit
				// TODO: callback show courses, ask confirmation to generate
		}
	}

	function verifyCredentials(username, password, callback) {
		$('#loader').fadeIn(300);

		// change with real method
		socket.emit('verify credentials', {
			username,
			password
		}, function (status) {
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
		"timeOut": "5000",
		"extendedTimeOut": "1000",
		"showEasing": "swing",
		"hideEasing": "linear",
		"showMethod": "fadeIn",
		"hideMethod": "fadeOut"
	}
});
