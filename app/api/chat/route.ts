// ... existing code ...
    const data = await response.json();
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      title: agent.name
    });

  } catch (_err) { // Added underscore to signify it's intentionally unused
    return NextResponse.json({ error: "Origo Brain Error" }, { status: 500 });
  }
}
