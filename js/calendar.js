document.addEventListener('DOMContentLoaded', function() {
var calendarEl = document.getElementById('calendar');
var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
    },
    events: [
    {
        title: 'Dr. Lee - John Doe',
        start: '2025-10-30T10:00:00',
        end: '2025-10-30T10:30:00',
        backgroundColor: '#007bff'
    },
    {
        title: 'Dr. Lee - Jane Smith',
        start: '2025-10-30T11:00:00',
        end: '2025-10-30T11:30:00',
        backgroundColor: '#ff5722'
    }
    ],
    editable: true,
    selectable: true,
    height: 'auto',
    contentHeight: 'auto',
    dayMaxEvents: true
    });
    calendar.render();
});