local Remotes = {}
local Parry_Key
local remoteparrysupport = false

if not(getgc) then
    warn("Remote parry not supported")
    remoteparrysupport = false
else
    for _, Value in getgc() do
        if type(Value) == "function" and islclosure(Value) then
            local Protos = debug.getprotos(Value)
            local Upvalues = debug.getupvalues(Value)
            local Constants = debug.getconstants(Value)
            if #Protos == 4 and #Upvalues == 24 and #Constants >= 102 then
                Remotes[debug.getupvalue(Value, 16)] = debug.getconstant(Value, 62)
                Parry_Key = debug.getupvalue(Value, 17)
                Remotes[debug.getupvalue(Value, 18)] = debug.getconstant(Value, 64)
                Remotes[debug.getupvalue(Value, 19)] = debug.getconstant(Value, 65)
                remoteparrysupport = true
                break
            end
        end
    end
end

return {
    Remotes = Remotes,
    Parry_Key = Parry_Key,
    remoteparrysupport = remoteparrysupport
}
