@echo OFF

echo.
echo UOTTAWA CALENDAR GENERATOR
echo.

echo.
echo == GRABBING THE FORM ID
echo ...
curl -s -L "https://uozone.uottawa.ca/user/login" | node getFormId.js > formId.txt
set /p formId=<formId.txt


if "%formId%"=="" ( 
	echo == UNSUCCESFUL REQUEST. MAYBE IT WAS THE CONNECTION, OR THE SITE' STRUCTURE HAS CHANGED SINCE.
) else (
	echo == SUCCESSFUL REQUEST. FORM ID IS VALID.
)

echo.
set /p username=Enter your uoZone username: 
set /p pass=Enter your uoZone password: 
echo.

echo == GRABBING LOGIN COOKIE
echo ...
curl  -s -c schedule_cookie.txt -L -X POST -d "name=%username%&pass=%pass%&form_build_id=%formId%&form_id=user_login_block&op=Login" "https://uozone2.uottawa.ca/user/login?language=en" | node verifyLogin.js > formResults.txt
set /p formResults=<formResults.txt

if "%formResults%"=="bad" ( 
	echo == WRONG CREDENTIALS
	echo.
) else (
	echo == CREDENTIALS VALID

	echo.

	:: debug this part, with the chain of redirects
	echo == GRABBING CURRENT SEMESTER' SCHEDULE
	echo ...
	curl -s -b schedule_cookie.txt -L "https://uozone2.uottawa.ca/academic" > schedule.html
	node verifyLogin.js < schedule.html > scheduleResults.txt
	set /p scheduleResults=<scheduleResults.txt
	echo == REQUEST COMPLETE

	echo.

	if "%scheduleResults%"=="bad" (
		echo == WRONG CREDENTIALS, OR COOKIE DIDN'T WORK.
	) else (
		echo == SCHEDULE SUCCESSFULLY GRABBED.
		echo.
	)
)


if exist formId.txt DEL formId.txt
if exist cookies.txt DEL cookies.txt
if exist formResults.txt DEL formResults.txt
if exist scheduleResults.txt DEL scheduleResults.txt

if defined formId set formId=
if defined username set username=
if defined pass set pass=
if defined formResults set formResults=
if defined scheduleResults set scheduleResults=

echo.
echo FINISHED

set /p deleteHtml=Do you want to delete the schedule.html file? y/n 

if "%deleteHtml%"=="y" (
	if exist schedule.html DEL schedule.html
)

set deleteHtml=